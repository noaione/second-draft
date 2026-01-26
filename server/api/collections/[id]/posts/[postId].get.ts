import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { H3Event } from 'h3';
import { renderMarkdownToHtml } from '~~/server/utils/renderer';
import { DatabaseThing, getDatabase, getStoredPosts, storeRenderedMarkdown, prepareDatabase } from '~~/server/utils/db';

async function getFromCollectionStored(
  db: DatabaseThing,
  collectionId: string,
  postId: string
) {
  const result = await getStoredPosts(db, collectionId, postId);
  return result;
}

async function getFromCollectionPath(
  event: H3Event,
  db: DatabaseThing,
  collectionId: string,
  postId: string
) {
  const runtimeConfig = useRuntimeConfig(event);
  const postPath = join(
    runtimeConfig.rootDir,
    'content',
    collectionId,
    'posts',
    `${postId}.md`
  );
  
  try {
    const markdownContent = await fs.readFile(postPath, 'utf-8');

    // Render with nuxt/content
    const results = await renderMarkdownToHtml(markdownContent);
    await storeRenderedMarkdown(db, results, `${collectionId}/posts/${postId}.md`);
    return results;
  } catch (error: any) {
    console.error(`Error rendering post file at ${postPath}:`, error);
    if (error?.code === 'ENOENT') {
      return null;
    }
  }
}

export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');
  const postId = getRouterParam(event, 'postId');
  const runtimeConfig = useRuntimeConfig(event);

  const dbPath = join(runtimeConfig.rootDir, '.output', 'server', 'dynamic-content.sqlite');

  if (!collectionId) {
    throw createError({
      statusCode: 400,
      message: 'Collection ID is required',
    });
  }
  if (!postId) {
    throw createError({
      statusCode: 400,
      message: 'Post ID is required',
    });
  }

  const db = getDatabase(dbPath);
  await prepareDatabase(db);

  try {
    const singlePostStored = await getFromCollectionStored(db, collectionId, postId);

    if (singlePostStored) {
      return {
        ...singlePostStored,
      };
    }

    const singlePost = await getFromCollectionPath(event, db, collectionId, postId);

    if (!singlePost) {
      throw createError({
        statusCode: 404,
        message: 'Post not found',
      });
    }

    return {
      ...singlePost,
    };
  } catch (error: any) {
    console.error('Error fetching post:', error);
    // Return empty array if no posts found
    return [];
  }
});
