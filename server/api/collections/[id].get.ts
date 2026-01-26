import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { CollectionMetadata } from '../../../types/patreon';

export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');

  if (!collectionId) {
    throw createError({
      statusCode: 400,
      message: 'Collection ID is required',
    });
  }

  const indexPath = join(process.cwd(), 'content', collectionId, 'index.json');

  try {
    const data = await fs.readFile(indexPath, 'utf-8');
    const metadata = JSON.parse(data) as CollectionMetadata;
    return metadata;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw createError({
        statusCode: 404,
        message: 'Collection not found',
      });
    }
    throw error;
  }
});
