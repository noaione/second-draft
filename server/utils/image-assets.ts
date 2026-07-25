import { createHash } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';
import type { Html, Image } from 'mdast';
import type { S3AssetsConfig } from '../../types/config';

let cachedClient: { client: S3Client; cacheKey: string } | undefined;

/**
 * Build (and cache) an S3 client for the given config. Works against any
 * S3-compatible provider (AWS, Wasabi, Cloudflare R2, MinIO, Backblaze B2, ...)
 * by pointing `endpoint` at the provider's endpoint.
 */
export function getS3Client(s3: S3AssetsConfig): S3Client {
  const cacheKey = `${s3.endpoint}|${s3.region}|${s3.accessKeyId}`;
  if (cachedClient && cachedClient.cacheKey === cacheKey) {
    return cachedClient.client;
  }

  const client = new S3Client({
    endpoint: s3.endpoint,
    region: s3.region ?? 'auto',
    forcePathStyle: s3.forcePathStyle ?? true,
    credentials: {
      accessKeyId: s3.accessKeyId,
      secretAccessKey: s3.secretAccessKey,
    },
  });

  cachedClient = { client, cacheKey };
  return client;
}

/** Build the S3 key for an image belonging to a given post. */
export function buildImageKey(s3: S3AssetsConfig, collectionId: string, postId: string, imgName: string): string {
  return `${s3.prefix ? `${s3.prefix}/` : ''}${collectionId}/${postId}/${imgName}`;
}

/** Build the same-origin proxy URL path that serves a rewritten image. */
export function buildProxyUrl(collectionId: string, postId: string, imgName: string): string {
  return `/api/collections/${collectionId}/posts/${postId}/img-proxy?img=${imgName}`;
}

function proxyUrlPrefix(collectionId: string, postId: string): string {
  return `/api/collections/${collectionId}/posts/${postId}/img-proxy?img=`;
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
};

function extensionFromContentType(contentType: string | null, url: string): string {
  if (contentType) {
    const base = contentType.split(';')[0]!.trim().toLowerCase();
    const known = EXT_BY_CONTENT_TYPE[base];
    if (known) return known;
  }

  try {
    const pathname = new URL(url).pathname;
    const match = /\.([a-zA-Z0-9]+)$/.exec(pathname);
    if (match) return `.${match[1]!.toLowerCase()}`;
  } catch {
    // Not a valid absolute URL — fall through to default
  }

  return '.jpg';
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string | null }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} downloading ${url}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.toLowerCase().startsWith('image/')) {
    throw new Error(`Refusing non-image content-type "${contentType}" for ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

async function uploadIfMissing(
  client: S3Client,
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return; // Object already exists — skip re-upload
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    if (status !== 404 && error?.name !== 'NotFound') {
      throw error;
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

interface ImageRef {
  url: string;
  start: number;
  end: number;
}

// Wattpad's styled-paragraph passthrough (see `styledInline` in
// wattpad-html-to-markdown.ts) wraps image markdown in raw `<p style="...">`
// tags. A run of those with no blank line between them collapses into a
// single CommonMark raw-HTML-block node — by spec, its contents are opaque
// to the parser and never become `image` nodes. This regex is only ever run
// against the isolated text of one such already-delimited `html` node (never
// the whole document), to recover the image references the parser
// intentionally didn't descend into.
const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\(\s*(<[^>\s]+>|[^\s)]+)(?:\s+"([^"]*)")?\s*\)/g;

function unwrapAngleBrackets(raw: string): string {
  return raw.startsWith('<') && raw.endsWith('>') ? raw.slice(1, -1) : raw;
}

/**
 * Walk `markdown` with a real markdown parser (mdast, the same AST already
 * used elsewhere in this codebase for Patreon's JSON→Markdown conversion)
 * and collect every image reference whose URL isn't already one of our own
 * proxy URLs — both proper `image` nodes, and image markdown embedded inside
 * raw `html` nodes (see above). Each ref carries the exact byte offsets of
 * its source span, which lets callers patch just the URL text in place
 * afterwards instead of re-serializing the whole document.
 */
function findImageRefs(markdown: string, collectionId: string, postId: string): ImageRef[] {
  const prefix = proxyUrlPrefix(collectionId, postId);
  const tree = fromMarkdown(markdown);
  const refs: ImageRef[] = [];

  visit(tree, (node) => {
    if (node.type === 'image') {
      const image = node as Image;
      if (image.url && image.position && !image.url.startsWith(prefix)) {
        refs.push({
          url: image.url,
          start: image.position.start.offset!,
          end: image.position.end.offset!,
        });
      }
      return;
    }

    if (node.type === 'html') {
      const html = node as Html;
      if (!html.position) return;
      const baseOffset = html.position.start.offset!;

      for (const match of html.value.matchAll(IMAGE_MARKDOWN_RE)) {
        const url = unwrapAngleBrackets(match[2]!);
        if (url.startsWith(prefix)) continue;
        const start = baseOffset + match.index!;
        refs.push({ url, start, end: start + match[0].length });
      }
    }
  });

  return refs;
}

/**
 * Download every image referenced in `markdown`, upload it to the configured
 * S3 bucket, and rewrite the markdown to point at the same-origin img-proxy
 * route instead of the original remote URL.
 *
 * Resilient by design: a failure on any single image (download error,
 * non-image content-type, S3 error) is logged and that image is left
 * pointing at its original URL — one bad image must never fail the whole post.
 */
export async function rewriteMarkdownImages(
  markdown: string,
  s3: S3AssetsConfig,
  ctx: { collectionId: string; postId: string },
): Promise<string> {
  const { collectionId, postId } = ctx;
  const imageRefs = findImageRefs(markdown, collectionId, postId);
  if (imageRefs.length === 0) return markdown;

  const client = getS3Client(s3);
  const uniqueUrls = Array.from(new Set(imageRefs.map((ref) => ref.url)));
  const replacements = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const { buffer, contentType } = await downloadImage(url);
        const ext = extensionFromContentType(contentType, url);
        const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
        const imgName = `${hash}${ext}`;
        const key = buildImageKey(s3, collectionId, postId, imgName);

        await uploadIfMissing(client, s3.bucket, key, buffer, contentType ?? 'application/octet-stream');

        replacements.set(url, buildProxyUrl(collectionId, postId, imgName));
      } catch (error) {
        console.warn(`[image-assets] Failed to rewrite image for post ${collectionId}/${postId}: ${url}`, error);
      }
    }),
  );

  if (replacements.size === 0) return markdown;

  // Patch each image ref's URL in place at its exact source offset,
  // back-to-front so earlier offsets stay valid as replacement lengths
  // differ from the original. Only the URL substring within each ref's own
  // span is touched — nothing else in the document is re-serialized, so
  // formatting elsewhere is guaranteed untouched.
  const edits = imageRefs
    .map((ref) => {
      const newUrl = replacements.get(ref.url);
      if (!newUrl) return null;

      const original = markdown.slice(ref.start, ref.end);
      const patched = original.replace(ref.url, newUrl);

      if (patched === original) {
        console.warn(
          `[image-assets] Could not locate URL "${ref.url}" within its own ref span for post ${collectionId}/${postId} — leaving untouched`,
        );
        return null;
      }

      return { start: ref.start, end: ref.end, text: patched };
    })
    .filter((edit): edit is { start: number; end: number; text: string } => edit !== null)
    .sort((a, b) => b.start - a.start);

  let result = markdown;
  for (const edit of edits) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }

  return result;
}
