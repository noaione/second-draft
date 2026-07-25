import TurndownService from 'turndown';
import type { CollectionMetadata, PatreonPostsListResponse, PostMetadata, S3AssetsConfig } from '../../types/config';
import { loadConfig } from './config';
import { saveCollectionMetadata, getDownloadedPosts, savePost } from './content-store';
import { PatreonClient } from './patreon-client';
import { patreonJsonToMarkdown } from './patreon-json-parser';
import { sendDiscordNotification, type SyncCollectionResult } from './discord-notifier';
import { rewriteMarkdownImages } from './image-assets';

/**
 * Rewrite images to the configured S3 bucket, if configured. Never throws —
 * a failed rewrite falls back to the original markdown so one bad image
 * doesn't block saving the post.
 */
async function rewriteImagesIfConfigured(
  markdown: string,
  s3: S3AssetsConfig | undefined,
  collectionId: string,
  postId: string,
): Promise<string> {
  if (!s3?.enabled) return markdown;
  try {
    return await rewriteMarkdownImages(markdown, s3, { collectionId, postId });
  } catch (error) {
    console.error(`Image rewrite failed for post ${postId}:`, error);
    return markdown;
  }
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

/**
 * Convert HTML content to Markdown
 */
function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
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
  campaignId: string,
  filter: { collectionId: string } | { tag: string },
  s3?: S3AssetsConfig,
): Promise<SyncCollectionResult> {
  console.log(`\n🔄 Syncing collection: ${collectionName} (${collectionId})`);

  // Get campaign info to extract creator name
  const campaign = await client.getCampaign(campaignId);
  const creatorId = campaign.data.relationships.creator.data.id;
  const creatorInfo = client.extractUserFromIncluded(campaign.included, creatorId);
  const creatorName = creatorInfo?.full_name || 'Unknown Creator';

  console.log(`   Creator: ${creatorName}`);

  // Get all posts for this campaign
  console.log('   Fetching posts from Patreon...');
  const posts = (await client.getCampaignPosts(campaignId, filter)).filter(post => post.attributes.current_user_can_view);
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

      // Rewrite images to S3, if configured
      const finalMarkdown = await rewriteImagesIfConfigured(markdownContent, s3, collectionId, postId);

      // Save post
      await savePost(collectionId, postId, metadata, finalMarkdown);
      downloadedCount++;
      collectedMeta.push(metadata);

      console.log(`   ✅ Saved: ${title}`);
    } catch (error) {
      console.error(`   ❌ Error downloading post ${post.id}:`, error);
    }
  }

  const finalizedPosts = posts.map(post => patreonToMeta(post, collectionId, collectionName, creatorName));

  // Update collection metadata
  const totalPosts = downloadedPosts.size + downloadedCount;
  const metadata: CollectionMetadata = {
    id: collectionId,
    name: collectionName,
    campaignId,
    lastSync: new Date().toISOString(),
    postCount: totalPosts,
    author: creatorName,
    posts: finalizedPosts,
    mode: 'patreon',
  };

  await saveCollectionMetadata(collectionId, metadata);

  const isNewSeries = downloadedPosts.size === 0;

  console.log(`   ✨ Sync complete! Downloaded ${downloadedCount} new posts`);
  console.log(`   📊 Total posts in collection: ${totalPosts}`);

  return {
    collectionName,
    collectionId,
    isNew: isNewSeries,
    newChapterCount: downloadedCount,
    totalChapters: totalPosts,
    mode: 'patreon',
  };
}

export async function syncSinglePatreonPost(rootDir: string, postId: string, collectionId: string) {
  console.log(`\n🔄 Syncing single post: ${postId}`);

  const config = await loadConfig(rootDir);

  if (!config.patreon?.sessionCookie) {
    throw new Error('Patreon session cookie not configured in config.json');
  }

  // Find collection
  const collection = config.patreon.collections.find((collection) => collection.id === collectionId);
  if (!collection) {
    throw new Error(`Collection ${collectionId} not found in config.json`);
  }

  const client = new PatreonClient(config.patreon.sessionCookie);

  const rawPost = await client.getPost(postId);
  const post = rawPost.data;
  const title = post.attributes.title || 'Untitled Post';

  console.log(`   📥 Downloading: ${title} (${postId})`);

  // Prefer structured JSON over HTML when available
  const jsonString = post.attributes.content_json_string;
  const markdownContent =
    patreonJsonToMarkdown(jsonString) ??
    htmlToMarkdown(post.attributes.content || '');

  const creator = client.extractUserFromIncluded(rawPost.included);
  const creatorName = creator?.full_name || 'Unknown Creator';

  // Create post metadata
  const metadata = patreonToMeta(post, collectionId, collection.name, creatorName);

  // Rewrite images to S3, if configured
  const finalMarkdown = await rewriteImagesIfConfigured(markdownContent, config.s3, collectionId, postId);

  // Save post
  await savePost(collectionId, postId, metadata, finalMarkdown);
  const collectionMeta: CollectionMetadata = {
    id: collectionId,
    name: collection.name,
    campaignId: collection.campaignId,
    lastSync: new Date().toISOString(),
    postCount: 1,
    author: creatorName,
    posts: [metadata],
    mode: 'patreon',
  };

  await saveCollectionMetadata(collectionId, collectionMeta);
}

/**
 * Manually sync specific posts by their Patreon IDs into a collection.
 * Useful for backfilling missing chapters that aren't returned by the
 * normal collection/tag-based API queries.
 *
 * Returns the same result shape as `syncCollection` so notifications
 * can be sent if desired.
 */
export async function syncPostsByIds(
  rootDir: string,
  collectionId: string,
  postIds: string[],
): Promise<SyncCollectionResult> {
  console.log(`\n🔄 Syncing ${postIds.length} specific post(s) into collection: ${collectionId}`);

  const config = await loadConfig(rootDir);

  if (!config.patreon?.sessionCookie) {
    throw new Error('Patreon session cookie not configured in config.json');
  }

  const collection = config.patreon.collections.find((c) => c.id === collectionId);
  if (!collection) {
    throw new Error(`Collection "${collectionId}" not found in config.json`);
  }

  const client = new PatreonClient(config.patreon.sessionCookie);

  // Count existing posts before we start
  const downloadedBefore = await getDownloadedPosts(collectionId);

  let downloadedCount = 0;
  const newMeta: PostMetadata[] = [];

  for (const postId of postIds) {
    try {
      console.log(`   📥 Fetching post: ${postId}`);

      const rawPost = await client.getPost(postId);
      const post = rawPost.data;
      const title = post.attributes.title || 'Untitled Post';

      // Prefer structured JSON over HTML when available
      const jsonString = post.attributes.content_json_string;
      const markdownContent =
        patreonJsonToMarkdown(jsonString) ??
        htmlToMarkdown(post.attributes.content || '');

      const creator = client.extractUserFromIncluded(rawPost.included);
      const creatorName = creator?.full_name || 'Unknown Creator';

      const metadata = patreonToMeta(post, collectionId, collection.name, creatorName);

      const finalMarkdown = await rewriteImagesIfConfigured(markdownContent, config.s3, collectionId, postId);

      await savePost(collectionId, postId, metadata, finalMarkdown);
      downloadedCount++;
      newMeta.push(metadata);

      console.log(`   ✅ Saved: ${title} (${postId})`);
    } catch (error) {
      console.error(`   ❌ Error downloading post ${postId}:`, error);
    }
  }

  // Merge metadata into the collection index.json
  const downloadedAfter = await getDownloadedPosts(collectionId);
  const totalPosts = downloadedAfter.size;

  const collectionMeta: CollectionMetadata = {
    id: collectionId,
    name: collection.name,
    campaignId: collection.campaignId,
    lastSync: new Date().toISOString(),
    postCount: totalPosts,
    author: newMeta[0]?.author,
    posts: newMeta,
    mode: 'patreon',
  };

  await saveCollectionMetadata(collectionId, collectionMeta);

  const isNewSeries = downloadedBefore.size === 0;

  console.log(`   ✨ Done! Downloaded ${downloadedCount} post(s)`);
  console.log(`   📊 Total posts in collection: ${totalPosts}`);

  return {
    collectionName: collection.name,
    collectionId,
    isNew: isNewSeries,
    newChapterCount: downloadedCount,
    totalChapters: totalPosts,
    mode: 'patreon',
  };
}

export async function syncPatreon(rootDir: string) {
  console.log('🚀 Starting Patreon sync task...');

  try {
    // Load configuration
    const config = await loadConfig(rootDir);

    if (!config.patreon?.sessionCookie) {
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
    const syncResults: SyncCollectionResult[] = [];
    for (const collection of collectionsToSync) {
      if (collection.complete) {
        console.log(`   ⚠️ Skipping completed collection: ${collection.name} (${collection.id})`);
        continue;
      }
      const filter: { collectionId: string } | { tag: string } =
        collection.tag ? { tag: collection.tag } : { collectionId: collection.id };
      const result = await syncCollection(
        client,
        collection.id,
        collection.name,
        collection.campaignId,
        filter,
        config.s3,
      );
      syncResults.push(result);
    }

    console.log('\n✅ All collections synced successfully!');

    // Send Discord notification if configured
    if (config.discord?.webhookUrl) {
      await sendDiscordNotification(config.discord.webhookUrl, syncResults);
    }

    return {
      result: 'Sync completed',
      collections: collectionsToSync.length,
    };
  } catch (error) {
    console.error('❌ Error during sync:', error);
    throw error;
  }
}
