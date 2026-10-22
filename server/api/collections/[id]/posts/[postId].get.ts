import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { H3Event } from 'h3';
import { renderMarkdownToHtml } from '~~/server/utils/renderer';
import { getDatabase, getStoredPosts, storeRenderedMarkdown, prepareDatabase } from '~~/server/utils/db';
import { CURRENT_MARKDOWN_FORMAT } from '~~/server/utils/versioning';

async function getFromCollectionPath(
  event: H3Event,
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

    const rendered = await renderMarkdownToHtml(markdownContent);
    return {
      ...rendered,
      description: rendered.description ?? '',
    };
  } catch (error) {
    console.error(`Error rendering post file at ${postPath}:`, error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');
  const postId = getRouterParam(event, 'postId');
  const runtimeConfig = useRuntimeConfig(event);

  const dbPath = join(runtimeConfig.rootDir, 'databases', 'dynamic-content.sqlite');

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
  try {
    await prepareDatabase(db);

    const storedPost = await getStoredPosts(db, collectionId, postId);
    if (storedPost?.version === CURRENT_MARKDOWN_FORMAT) {
      return storedPost;
    }

    const singlePost = await getFromCollectionPath(event, collectionId, postId);

    if (!singlePost) {
      throw createError({
        statusCode: 404,
        message: 'Post not found',
      });
    }

    const relativePath = `${collectionId}/posts/${postId}.md`;
    await storeRenderedMarkdown(db, singlePost, relativePath);

    return {
      ...singlePost,
      id: `content/${relativePath}`,
    };
  } finally {
    await db.dispose();
  }
});
