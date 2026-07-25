import { createHash } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { visit } from 'unist-util-visit';
import type { Image, Root } from 'mdast';
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

/** Build the S3 key for an image belonging to a given series. */
export function buildImageKey(s3: S3AssetsConfig, seriesId: string, imageKey: string): string {
  return `${s3.prefix ? `${s3.prefix}/` : ''}${seriesId}/${imageKey}`;
}

/** Build the former per-post key so existing proxied images remain readable. */
export function buildLegacyImageKey(
  s3: S3AssetsConfig,
  seriesId: string,
  postId: string,
  imageKey: string,
): string {
  return `${s3.prefix ? `${s3.prefix}/` : ''}${seriesId}/${postId}/${imageKey}`;
}

/** Build the same-origin proxy URL path that serves a rewritten image. */
export function buildProxyUrl(seriesId: string, postId: string, imageKey: string): string {
  return `/api/collections/${seriesId}/posts/${postId}/img-proxy?img=${imageKey}`;
}

function isProxyUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'http://localhost');
    return /^\/api\/collections\/[^/]+\/posts\/[^/]+\/img-proxy$/.test(parsed.pathname)
      && parsed.searchParams.has('img');
  } catch {
    return false;
  }
}

function normalizeContentType(contentType: string | null): string {
  if (!contentType) return 'application/octet-stream';
  return contentType.split(';')[0]!.trim().toLowerCase();
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/avif': '.avif',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
};

export function imageExtension(contentType: string | null, url: string): string {
  const extensionForType = EXTENSION_BY_CONTENT_TYPE[normalizeContentType(contentType)];
  if (extensionForType) return extensionForType;

  const pathname = new URL(canonicalImageUrl(url)).pathname;
  const match = /\.([a-zA-Z0-9]+)$/.exec(pathname);
  return match ? `.${match[1]!.toLowerCase()}` : '.jpg';
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

/**
 * Return the stable form used to identify an image. Signed URL query
 * parameters are deliberately excluded because they can change while still
 * pointing at the same image.
 */
export function canonicalImageUrl(url: string): string {
  const parsed = new URL(url);
  parsed.search = '';
  return parsed.toString();
}

/** Hash only the stable, query-free URL rather than expiring URL parameters. */
export function imageUrlHash(url: string): string {
  return createHash('sha256').update(canonicalImageUrl(url)).digest('hex');
}

interface ImageAsset {
  hash: string;
  urls: string[];
}

function collectImageAssets(tree: Root): Map<string, ImageAsset> {
  const assets = new Map<string, ImageAsset>();

  visit(tree, 'image', (image: Image) => {
    if (!image.url || isProxyUrl(image.url)) return;

    try {
      const hash = imageUrlHash(image.url);
      const asset = assets.get(hash);
      if (asset) {
        if (!asset.urls.includes(image.url)) asset.urls.push(image.url);
      } else {
        assets.set(hash, { hash, urls: [image.url] });
      }
    } catch {
      // Relative and otherwise invalid remote URLs cannot be downloaded.
    }
  });

  return assets;
}

async function downloadFirstAvailable(
  urls: string[],
): Promise<{ buffer: Buffer; contentType: string | null }> {
  let lastError: unknown;

  for (const url of urls) {
    try {
      return await downloadImage(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
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
  const tree = fromMarkdown(markdown);
  const assets = collectImageAssets(tree);
  if (assets.size === 0) return markdown;

  const client = getS3Client(s3);
  const proxyUrlByHash = new Map<string, string>();

  await Promise.all(
    Array.from(assets.values(), async (asset) => {
      try {
        const { buffer, contentType } = await downloadFirstAvailable(asset.urls);
        const imageKey = `${asset.hash}${imageExtension(contentType, asset.urls[0]!)}`;
        const key = buildImageKey(s3, collectionId, imageKey);

        await uploadIfMissing(client, s3.bucket, key, buffer, normalizeContentType(contentType));

        proxyUrlByHash.set(asset.hash, buildProxyUrl(collectionId, postId, imageKey));
      } catch (error) {
        console.warn(
          `[image-assets] Failed to rewrite image for post ${collectionId}/${postId}: ${asset.urls.join(', ')}`,
          error,
        );
      }
    }),
  );

  if (proxyUrlByHash.size === 0) return markdown;

  visit(tree, 'image', (image: Image) => {
    if (!image.url || isProxyUrl(image.url)) return;

    try {
      const proxyUrl = proxyUrlByHash.get(imageUrlHash(image.url));
      if (proxyUrl) image.url = proxyUrl;
    } catch {
      // Leave invalid URLs untouched.
    }
  });

  return toMarkdown(tree);
}
