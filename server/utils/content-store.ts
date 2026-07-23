import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import { join } from 'node:path';
import type { CollectionMetadata, PostMetadata } from '../../types/config';

/**
 * Ensure directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * Save collection metadata
 */
export async function saveCollectionMetadata(
  collectionId: string,
  metadata: CollectionMetadata
): Promise<void> {
  const collectionDir = join(process.cwd(), 'content', collectionId);
  await ensureDir(collectionDir);

  const metadataPath = join(collectionDir, 'index.json');
  // read the data first, then merge the posts together
  let oldPosts = [];
  if (fsSync.existsSync(metadataPath)) {
    const readData = await fs.readFile(metadataPath, 'utf-8');
    oldPosts = JSON.parse(readData).posts || [];
  }

  // merge data together, prioritizing new posts metadata
  const mergedPosts = [...oldPosts, ...(metadata.posts ?? [])];
  // unique set
  const uniquePosts = new Set(mergedPosts.map((post) => post.postId));

  metadata.posts = Array.from(uniquePosts).map((postId) => {
    return mergedPosts.find((post) => post.postId === postId)!;
  });
  metadata.posts.sort((ab, bc) => ab.postId.localeCompare(bc.postId));
  metadata.postCount = metadata.posts.length;
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Get list of already downloaded post IDs for a collection
 */
export async function getDownloadedPosts(collectionId: string): Promise<Set<string>> {
  const postsDir = join(process.cwd(), 'content', collectionId, 'posts');
  const downloadedPosts = new Set<string>();

  try {
    const files = await fs.readdir(postsDir);
    for (const file of files) {
      if (file.endsWith('.md')) {
        const postId = file.replace('.md', '');
        downloadedPosts.add(postId);
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
  }

  return downloadedPosts;
}

/**
 * Create markdown file with frontmatter
 */
export function createMarkdownWithFrontmatter(metadata: PostMetadata, content: string): string {
  const frontmatter = `---
title: "${metadata.title.replace(/"/g, '\\"')}"
postId: "${metadata.postId}"
publishedAt: "${metadata.publishedAt}"
author: "${metadata.author.replace(/"/g, '\\"')}"
collectionName: "${metadata.collectionName.replace(/"/g, '\\"')}"
collectionId: "${metadata.collectionId}"
---

`;

  return frontmatter + content;
}

/**
 * Save a post as a markdown file
 */
export async function savePost(
  collectionId: string,
  postId: string,
  metadata: PostMetadata,
  content: string
): Promise<void> {
  const postsDir = join(process.cwd(), 'content', collectionId, 'posts');
  await ensureDir(postsDir);

  const postPath = join(postsDir, `${postId}.md`);
  const markdown = createMarkdownWithFrontmatter(metadata, content);

  await fs.writeFile(postPath, markdown, 'utf-8');
}
