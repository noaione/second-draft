import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { CollectionMetadata } from '../../../types/patreon';

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const contentDir = join(runtimeConfig.rootDir, 'content');
  const collections: CollectionMetadata[] = [];

  try {
    const entries = await fs.readdir(contentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.')) {
          continue;
        }
        const indexPath = join(contentDir, entry.name, 'index.json');

        try {
          const data = await fs.readFile(indexPath, 'utf-8');
          const metadata = JSON.parse(data) as CollectionMetadata;
          collections.push(metadata);
        } catch (error) {
          // Skip if index.json doesn't exist or is invalid
          continue;
        }
      }
    }

    // Sort by name
    collections.sort((a, b) => a.name.localeCompare(b.name));

    return collections;
  } catch (error) {
    // Return empty array if content directory doesn't exist
    return [];
  }
});
