import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import TurndownService from 'turndown';
import type { AppConfig, CollectionMetadata, PatreonPostsListResponse, PostMetadata } from '../../types/patreon';
import { PatreonClient } from './patreon-client';
import { patreonJsonToMarkdown } from './patreon-json-parser';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

/**
 * Ensure directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * Load configuration from config.json
 */
async function loadConfig(rootDir: string): Promise<AppConfig> {
  const configPath = join(rootDir, 'config.json');
  const configData = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(configData);
}

/**
 * Save collection metadata
 */
async function saveCollectionMetadata(
  collectionId: string,
  metadata: CollectionMetadata
): Promise<void> {
  const collectionDir = join(process.cwd(), 'content', collectionId);
  await ensureDir(collectionDir);

  const metadataPath = join(collectionDir, 'index.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Get list of already downloaded post IDs for a collection
 */
async function getDownloadedPosts(collectionId: string): Promise<Set<string>> {
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
 * Convert HTML content to Markdown
 */
function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

/**
 * Create markdown file with frontmatter
 */
function createMarkdownWithFrontmatter(metadata: PostMetadata, content: string): string {
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
async function savePost(
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

function patreonToMeta(post: PatreonPostsListResponse['data'][0], collectionId: string, collectionName: string, author: string): PostMetadata {
  const postId = post.id;
  const title = post.attributes.title || 'Untitled Post';
  const publishedAt = post.attributes.published_at;

  return {
    title,
    postId,
    publishedAt,
    author,
    collectionName,
    collectionId,
  };
}

/**
 * Sync a single collection
 */
async function syncCollection(
  client: PatreonClient,
  collectionId: string,
  collectionName: string,
  campaignId: string
): Promise<void> {
  console.log(`\n🔄 Syncing collection: ${collectionName} (${collectionId})`);

  // Get campaign info to extract creator name
  const campaign = await client.getCampaign(campaignId);
  const creatorId = campaign.data.relationships.creator.data.id;
  const creatorInfo = client.extractUserFromIncluded(campaign.included, creatorId);
  const creatorName = creatorInfo?.full_name || 'Unknown Creator';

  console.log(`   Creator: ${creatorName}`);

  // Get all posts for this campaign
  console.log('   Fetching posts from Patreon...');
  const posts = (await client.getCampaignPosts(collectionId, campaignId)).filter(post => post.attributes.current_user_can_view);
  console.log(`   Found ${posts.length} accessible posts on Patreon`);

  // Get already downloaded posts
  const downloadedPosts = await getDownloadedPosts(collectionId);
  console.log(`   Already downloaded: ${downloadedPosts.size} posts`);

  // Filter for missing posts
  const missingPosts = posts.filter(post => !downloadedPosts.has(post.id));
  console.log(`   Missing posts to download: ${missingPosts.length}`);

  // Download missing posts
  let downloadedCount = 0;
  const collectedMeta = [];
  for (const post of missingPosts) {
    try {
      const postId = post.id;
      const title = post.attributes.title || 'Untitled Post';

      console.log(`   📥 Downloading: ${title} (${postId})`);

      // Prefer structured JSON over HTML when available
      const jsonString = post.attributes.content_json_string;
      const markdownContent =
        patreonJsonToMarkdown(jsonString) ??
        htmlToMarkdown(post.attributes.content || '');

      // Create post metadata
      const metadata = patreonToMeta(post, collectionId, collectionName, creatorName);

      // Save post
      await savePost(collectionId, postId, metadata, markdownContent);
      downloadedCount++;
      collectedMeta.push(metadata);

      console.log(`   ✅ Saved: ${title}`);
    } catch (error) {
      console.error(`   ❌ Error downloading post ${post.id}:`, error);
    }
  }

  // Update collection metadata
  const totalPosts = downloadedPosts.size + downloadedCount;
  const metadata: CollectionMetadata = {
    id: collectionId,
    name: collectionName,
    campaignId,
    lastSync: new Date().toISOString(),
    postCount: totalPosts,
    posts: posts.map(post => patreonToMeta(post, collectionId, collectionName, creatorName)),
  };

  await saveCollectionMetadata(collectionId, metadata);

  console.log(`   ✨ Sync complete! Downloaded ${downloadedCount} new posts`);
  console.log(`   📊 Total posts in collection: ${totalPosts}`);
}

export async function syncPatreon(rootDir: string) {
  console.log('🚀 Starting Patreon sync task...');

  try {
    // Load configuration
    const config = await loadConfig(rootDir);

    if (!config.patreon.sessionCookie) {
      throw new Error('Patreon session cookie not configured in config.json');
    }

    if (config.patreon.collections.length === 0) {
      console.log('⚠️  No collections configured. Add collections to config.json');
      return { result: 'No collections to sync' };
    }

    // Initialize Patreon client
    const client = new PatreonClient(config.patreon.sessionCookie);

    // Filter collections if specific one requested
    const collectionsToSync = config.patreon.collections;

    if (collectionsToSync.length === 0) {
      throw new Error('No collections configured for syncing');
    }

    // Sync each collection
    let totalDownloaded = 0;
    for (const collection of collectionsToSync) {
      if (collection.complete) {
        console.log(`   ⚠️ Skipping completed collection: ${collection.name} (${collection.id})`);
        continue;
      }
      await syncCollection(
        client,
        collection.id,
        collection.name,
        collection.campaignId
      );
    }

    console.log('\n✅ All collections synced successfully!');

    return {
      result: 'Sync completed',
      collections: collectionsToSync.length,
    };
  } catch (error) {
    console.error('❌ Error during sync:', error);
    throw error;
  }
}
