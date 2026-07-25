/**
 * Backfill script: rewrite images already baked into synced markdown files
 * to point at the configured S3 bucket (via the img-proxy API route)
 * instead of their original, possibly-expiring remote URLs.
 *
 * Usage:
 *   bun run backfill:images [collectionId]
 *
 * If no collectionId is given, every collection under content/ is processed.
 * Safe to re-run: rewriteMarkdownImages skips URLs that already point at
 * our own img-proxy route, so already-backfilled posts are left untouched.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { S3AssetsConfig } from '../types/config';
import { loadConfig } from '../server/utils/config';
import { rewriteMarkdownImages } from '../server/utils/image-assets';

const rootDir = join(import.meta.dirname, '..');
const contentDir = join(rootDir, 'content');

function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  if (!raw.startsWith('---\n')) return { frontmatter: '', body: raw };
  const closingIndex = raw.indexOf('\n---\n', 4);
  if (closingIndex === -1) return { frontmatter: '', body: raw };
  let bodyStart = closingIndex + '\n---\n'.length;
  if (raw[bodyStart] === '\n') bodyStart += 1;
  return { frontmatter: raw.slice(0, bodyStart), body: raw.slice(bodyStart) };
}

function countProxyRefs(text: string): number {
  return (text.match(/\/img-proxy\?img=/g) ?? []).length;
}

async function listCollectionIds(filter?: string): Promise<string[]> {
  if (filter) return [filter];
  const entries = await fs.readdir(contentDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function processPost(s3: S3AssetsConfig, collectionId: string, postFile: string): Promise<number> {
  const postPath = join(contentDir, collectionId, 'posts', postFile);
  const postId = postFile.replace(/\.md$/, '');
  const raw = await fs.readFile(postPath, 'utf-8');
  const { frontmatter, body } = splitFrontmatter(raw);

  const rewrittenBody = await rewriteMarkdownImages(body, s3, { collectionId, postId });
  if (rewrittenBody === body) return 0;

  await fs.writeFile(postPath, frontmatter + rewrittenBody, 'utf-8');
  return countProxyRefs(rewrittenBody) - countProxyRefs(body);
}

async function main() {
  const filterCollectionId = process.argv[2];

  const config = await loadConfig(rootDir);
  if (!config.s3) {
    console.log('⚠️  No `s3` block configured in config.json — nothing to backfill.');
    return;
  }

  const collectionIds = await listCollectionIds(filterCollectionId);
  console.log(`🔄 Backfilling images for ${collectionIds.length} collection(s)...`);

  let postsScanned = 0;
  let postsChanged = 0;
  let imagesRewritten = 0;

  for (const collectionId of collectionIds) {
    const postsDir = join(contentDir, collectionId, 'posts');
    let postFiles: string[];
    try {
      postFiles = (await fs.readdir(postsDir)).filter((f) => f.endsWith('.md'));
    } catch (error: any) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }

    for (const postFile of postFiles) {
      postsScanned++;
      try {
        const count = await processPost(config.s3, collectionId, postFile);
        if (count > 0) {
          postsChanged++;
          imagesRewritten += count;
          console.log(`   ✅ ${collectionId}/${postFile}: rewrote ${count} image(s)`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing ${collectionId}/${postFile}:`, error);
      }
    }
  }

  console.log(
    `\n✨ Done — scanned ${postsScanned} post(s), changed ${postsChanged}, rewrote ${imagesRewritten} image reference(s).`,
  );
}

await main();
