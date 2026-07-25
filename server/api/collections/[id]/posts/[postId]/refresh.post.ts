import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { renderMarkdownToHtml } from '~~/server/utils/renderer';
import { getDatabase, prepareDatabase, deleteStoredPost, storeRenderedMarkdown } from '~~/server/utils/db';

/**
 * Force a post to be re-read from its source markdown file and re-rendered,
 * replacing whatever's currently cached in the render DB. Used by the
 * "force re-render" button in the reader — useful after a markdown-
 * generation fix (e.g. a Turndown rule change) that a normal cache hit
 * would otherwise keep hiding.
 */
export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');
  const postId = getRouterParam(event, 'postId');

  if (!collectionId || !postId) {
    throw createError({
      statusCode: 400,
      message: 'Collection ID and Post ID are required',
    });
  }

  const runtimeConfig = useRuntimeConfig(event);
  const postPath = join(runtimeConfig.rootDir, 'content', collectionId, 'posts', `${postId}.md`);
  const dbPath = join(runtimeConfig.rootDir, '.output', 'server', 'dynamic-content.sqlite');

  let markdownContent: string;
  try {
    markdownContent = await fs.readFile(postPath, 'utf-8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw createError({ statusCode: 404, message: 'Post not found' });
    }
    throw error;
  }

  const db = getDatabase(dbPath);
  await prepareDatabase(db);

  const result = await renderMarkdownToHtml(markdownContent);
  await deleteStoredPost(db, collectionId, postId);
  await storeRenderedMarkdown(db, result, `${collectionId}/posts/${postId}.md`);

  return { ...result };
});
