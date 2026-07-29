import type { CollectionMetadata, PostMetadata, S3AssetsConfig } from '../../types/config';
import type { WattpadStoryResponse } from '../../types/wattpad';
import { loadConfig } from './config';
import { saveCollectionMetadata, getDownloadedPosts, savePost } from './content-store';
import { WattpadClient } from './wattpad-client';
import { wattpadHtmlToMarkdown } from './wattpad-html-to-markdown';
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

function wattpadToMeta(
  part: WattpadStoryResponse['parts'][0],
  folderId: string,
  collectionName: string,
  author: string,
): PostMetadata {
  return {
    title: part.title || 'Untitled Chapter',
    postId: String(part.id),
    publishedAt: part.createDate ?? new Date().toISOString(),
    author,
    collectionName,
    collectionId: folderId,
  };
}

/**
 * Sync a single Wattpad story into its own collection folder.
 * Mirrors patreon-sync.ts's syncCollection, but Wattpad returns all
 * parts in one call — no pagination or JSON/HTML branching needed.
 */
async function syncCollection(
  client: WattpadClient,
  storyId: string,
  collectionName: string,
  s3?: S3AssetsConfig,
): Promise<SyncCollectionResult> {
  const folderId = `wp-${storyId}`;

  console.log(`\n🔄 Syncing Wattpad story: ${collectionName} (${storyId})`);

  const story = await client.getStory(storyId);
  const authorName = story.user?.name || 'Unknown Author';

  console.log(`   Author: ${authorName}`);
  console.log(`   Found ${story.parts.length} parts on Wattpad`);

  const downloadedPosts = await getDownloadedPosts(folderId);
  console.log(`   Already downloaded: ${downloadedPosts.size} posts`);

  const missingParts = story.parts.filter((part) => !downloadedPosts.has(String(part.id)));
  console.log(`   Missing parts to download: ${missingParts.length}`);

  let downloadedCount = 0;
  const failedPartIds = new Set<string>();
  for (const part of missingParts) {
    try {
      console.log(`   📥 Downloading: ${part.title} (${part.id})`);

      const html = await client.getPartText(part.text_url.text);
      const markdownContent = wattpadHtmlToMarkdown(html);

      const metadata = wattpadToMeta(part, folderId, collectionName, authorName);

      const finalMarkdown = await rewriteImagesIfConfigured(markdownContent, s3, folderId, String(part.id));

      await savePost(folderId, String(part.id), metadata, finalMarkdown);
      downloadedCount++;

      console.log(`   ✅ Saved: ${part.title}`);
    } catch (error) {
      console.error(`   ❌ Error downloading part ${part.id}:`, error);
      // Never index a chapter that failed to save — there's no file behind it.
      failedPartIds.add(String(part.id));
    }
  }

  const finalizedPosts = story.parts
    .filter((part) => !failedPartIds.has(String(part.id)))
    .map((part) => wattpadToMeta(part, folderId, collectionName, authorName));

  const totalPosts = downloadedPosts.size + downloadedCount;
  const metadata: CollectionMetadata = {
    id: folderId,
    name: collectionName,
    campaignId: storyId,
    lastSync: new Date().toISOString(),
    postCount: totalPosts,
    author: authorName,
    posts: finalizedPosts,
    mode: 'wattpad',
  };

  await saveCollectionMetadata(folderId, metadata);

  const isNewSeries = downloadedPosts.size === 0;

  console.log(`   ✨ Sync complete! Downloaded ${downloadedCount} new parts`);
  console.log(`   📊 Total parts in collection: ${totalPosts}`);

  return {
    collectionName,
    collectionId: folderId,
    isNew: isNewSeries,
    newChapterCount: downloadedCount,
    totalChapters: totalPosts,
    mode: 'wattpad',
  };
}

export async function syncWattpad(rootDir: string) {
  console.log('🚀 Starting Wattpad sync task...');

  try {
    const config = await loadConfig(rootDir);

    if (!config.wattpad) {
      throw new Error('Wattpad not configured in config.json');
    }

    if (config.wattpad.collections.length === 0) {
      console.log('⚠️  No collections configured. Add collections to config.json');
      return { result: 'No collections to sync' };
    }

    const client = new WattpadClient(config.wattpad.sessionCookie);

    const collectionsToSync = config.wattpad.collections;

    const syncResults: SyncCollectionResult[] = [];
    for (const collection of collectionsToSync) {
      if (collection.complete) {
        console.log(`   ⚠️ Skipping completed collection: ${collection.name} (${collection.id})`);
        continue;
      }
      const result = await syncCollection(client, collection.id, collection.name, config.s3);
      syncResults.push(result);
    }

    console.log('\n✅ All collections synced successfully!');

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
