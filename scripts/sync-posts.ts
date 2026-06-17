/**
 * Manual post sync script.
 *
 * Downloads one or more specific Patreon posts by ID into a collection.
 * Useful when the normal collection/tag-based API doesn't return every
 * chapter (e.g. Patreon collections that are incomplete or have gaps).
 *
 * Usage:
 *   bun run sync:posts <collectionId> <postId1> [postId2] [postId3] ...
 *
 * Example:
 *   bun run sync:posts 1848812 123456789 987654321
 */

import { syncPostsByIds, syncPatreon } from '../server/utils/patreon-sync';
import { join } from 'node:path';

const rootDir = join(import.meta.dirname, '..');

const args = process.argv.slice(2);

function printUsage() {
  console.log(`
Usage: bun run sync:posts <collectionId> <postId1> [postId2] [postId3] ...

Arguments:
  collectionId    The collection ID from config.json (e.g. "1848812")
  postId1...      One or more Patreon post IDs to download

If no post IDs are provided, falls back to a full sync of all collections
(equivalent to running "bun run sync:patreon").
`);
}

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printUsage();
  process.exit(0);
}

const [collectionId, ...postIds] = args;

if (postIds.length === 0) {
  console.log('⚠️  No post IDs provided — running full sync instead.\n');
  await syncPatreon(rootDir);
  process.exit(0);
}

console.log(`Collection: ${collectionId}`);
console.log(`Posts to fetch: ${postIds.join(', ')}`);
console.log(`Total: ${postIds.length} post(s)\n`);

try {
  const result = await syncPostsByIds(rootDir, collectionId, postIds);
  console.log(`\n✅ Done — ${result.newChapterCount} post(s) downloaded, ${result.totalChapters} total in collection.`);
} catch (error) {
  console.error('❌ Sync failed:', error);
  process.exit(1);
}
