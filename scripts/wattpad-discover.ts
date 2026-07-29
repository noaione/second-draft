/**
 * Discover new stories from Wattpad authors already tracked in config.json.
 *
 * For every author behind an existing `wattpad.collections` entry, fetches
 * that author's full published-story list and appends any story not yet
 * present to `wattpad.collections`. Newly added entries default to
 * `complete: false` (actively synced) regardless of Wattpad's own
 * completion flag — mark them complete manually once reviewed.
 *
 * Usage:
 *   bun run wattpad:discover
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WattpadClient } from '../server/utils/wattpad-client';

const rootDir = join(import.meta.dirname, '..');
const configPath = join(rootDir, 'config.json');

interface RawWattpadCollection {
  id: string;
  name: string;
  complete?: boolean;
}

(async () => {
  const raw = JSON.parse(await readFile(configPath, 'utf-8'));

  if (!raw.wattpad || !Array.isArray(raw.wattpad.collections)) {
    console.error('❌ No `wattpad.collections` found in config.json');
    process.exit(1);
  }

  const collections: RawWattpadCollection[] = raw.wattpad.collections;
  const existingIds = new Set(collections.map((c) => c.id));

  if (collections.length === 0) {
    console.log('⚠️  No existing Wattpad collections to derive authors from.');
    process.exit(0);
  }

  const client = new WattpadClient(raw.wattpad.sessionCookie);

  console.log(`🔎 Looking up authors for ${collections.length} tracked stories...`);
  const usernames = new Set<string>();
  for (const collection of collections) {
    try {
      const author = await client.getStoryAuthor(collection.id);
      if (author.username) usernames.add(author.username);
    } catch (error) {
      console.error(`   ⚠️  Could not look up story ${collection.id} (${collection.name}):`, error);
    }
  }

  if (usernames.size === 0) {
    console.error('❌ Could not resolve any authors — aborting.');
    process.exit(1);
  }

  console.log(`👤 Found ${usernames.size} unique author(s): ${[...usernames].join(', ')}\n`);

  const newEntries: RawWattpadCollection[] = [];
  for (const username of usernames) {
    console.log(`📚 Fetching stories by ${username}...`);
    const stories = await client.getUserPublishedStories(username);
    console.log(`   Found ${stories.length} published stories`);

    for (const story of stories) {
      if (existingIds.has(story.id)) continue;
      newEntries.push({ id: story.id, name: story.title, complete: false });
      existingIds.add(story.id); // guard against duplicates across authors
    }
  }

  if (newEntries.length === 0) {
    console.log('\n✅ No new stories found — config.json is already up to date.');
    process.exit(0);
  }

  console.log(`\n🆕 Adding ${newEntries.length} new story(ies):`);
  for (const entry of newEntries) {
    console.log(`   + ${entry.id} — ${entry.name}`);
  }

  raw.wattpad.collections.push(...newEntries);

  await writeFile(configPath, JSON.stringify(raw, null, 4) + '\n', 'utf-8');
  console.log(`\n✅ Saved. config.json now has ${raw.wattpad.collections.length} Wattpad collections.`);
})();
