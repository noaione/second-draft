import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { H3Event } from 'h3';
import { renderMarkdownToHtml, storeRenderedMarkdown } from '~~/server/utils/renderer';

async function getFromCollectionPost(event: H3Event, collectionId: string, postId: string) {
  // Query all posts in this collection using path pattern
  const singlePost = await queryCollection(event, 'content')
    .where('collectionId', '=', collectionId)
    .where('postId', '=', postId)
    .first();

  return singlePost;
}

async function getFromCollectionPath(event: H3Event, collectionId: string, postId: string) {
  const runtimeConfig = useRuntimeConfig(event);

  const postPath = join(
    runtimeConfig.rootDir,
    'content',
    collectionId,
    'posts',
    `${postId}.md`
  );
  console.log(`Reading post file from path: ${postPath}`);
  const dbPath = join(runtimeConfig.rootDir, '.data', 'content', 'contents.sqlite');
  
  try {
    console.log(`Attempting to read markdown file at ${postPath}`);
    const markdownContent = await fs.readFile(postPath, 'utf-8');

    // Render with nuxt/content
    console.log(`Rendering markdown content for postId ${postId} in collection ${collectionId}`);
    const results = await renderMarkdownToHtml(markdownContent);
    console.log(`Storing rendered markdown content for postId ${postId} in collection ${collectionId} to database`);
    await storeRenderedMarkdown(results, `${collectionId}/posts/${postId}.md`, dbPath);
    console.log(`Successfully processed postId ${postId} in collection ${collectionId}`);
    return results;
  } catch (error: any) {
    console.error(`Error reading post file at ${postPath}:`, error);
    if (error?.code === 'ENOENT') {
      return null;
    }
  }
}

export default defineEventHandler(async (event) => {
  const collectionId = getRouterParam(event, 'id');
  const postId = getRouterParam(event, 'postId');

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

  try {
    const post = await getFromCollectionPost(event, collectionId, postId);
    console.log('Post from collection query:', post);
    if (post !== null) {
      return {
        ...post,
      }
    }

    const singlePost = await getFromCollectionPath(event, collectionId, postId);
    console.log('Post from file path query:', singlePost);

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
    // Return empty array if no posts found
    return [];
  }
});
