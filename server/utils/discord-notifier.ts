/**
 * Discord webhook notifier for sync reports (Patreon, Wattpad).
 *
 * Notifies when:
 *   1. A new series is added (with chapter count)
 *   2. An existing series gets new chapters
 *
 * Only results with `newChapterCount > 0` trigger a notification.
 */

import type { ContentMode } from '../../types/config';

export interface SyncCollectionResult {
  collectionName: string;
  collectionId: string;
  /** True when this collection had zero downloaded posts before the sync */
  isNew: boolean;
  /** Number of chapters downloaded during this sync */
  newChapterCount: number;
  /** Total chapter count after the sync */
  totalChapters: number;
  mode: ContentMode;
}

interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline: boolean;
  }>;
  timestamp: string;
  footer: { text: string };
}

/**
 * Send a Discord webhook notification summarising the sync results.
 * Silently returns when there are no changes or the webhook URL is empty.
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  results: SyncCollectionResult[],
): Promise<void> {
  if (!webhookUrl) return;

  const relevant = results.filter((r) => r.newChapterCount > 0);
  if (relevant.length === 0) {
    console.log('🔔 No new chapters — skipping Discord notification.');
    return;
  }

  const newSeries = relevant.filter((r) => r.isNew);
  const updatedSeries = relevant.filter((r) => !r.isNew);

  const descParts: string[] = [];

  if (newSeries.length > 0) {
    const totalNew = newSeries.reduce((sum, r) => sum + r.newChapterCount, 0);
    descParts.push(
      `🆕 **${newSeries.length} new series** added with **${totalNew} chapter${totalNew > 1 ? 's' : ''}**`,
    );
  }

  if (updatedSeries.length > 0) {
    const totalNew = updatedSeries.reduce((sum, r) => sum + r.newChapterCount, 0);
    descParts.push(
      `📝 **${updatedSeries.length} series** updated with **${totalNew} new chapter${totalNew > 1 ? 's' : ''}**`,
    );
  }

  const modes = new Set(relevant.map((r) => r.mode));
  const title = modes.size > 1
    ? '🔄 Sync Report'
    : modes.has('wattpad')
      ? '📖 Wattpad Sync Report'
      : '📚 Patreon Sync Report';

  const embed: DiscordEmbed = {
    title,
    description: descParts.join('\n'),
    color: newSeries.length > 0 ? 0x57F287 : 0x5865F2, // green for new, blurple for updates
    fields: [],
    timestamp: new Date().toISOString(),
    footer: { text: '#seconddraft' },
  };

  if (newSeries.length > 0) {
    embed.fields.push({
      name: '🆕 New Series',
      value: newSeries
        .map((r) => `• **${r.collectionName}** — ${r.newChapterCount} chapter${r.newChapterCount > 1 ? 's' : ''}`)
        .join('\n'),
      inline: false,
    });
  }

  if (updatedSeries.length > 0) {
    embed.fields.push({
      name: '📝 Updated Series',
      value: updatedSeries
        .map(
          (r) =>
            `• **${r.collectionName}** — +${r.newChapterCount} chapter${r.newChapterCount > 1 ? 's' : ''} (${r.totalChapters} total)`,
        )
        .join('\n'),
      inline: false,
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      console.error(
        `❌ Discord webhook failed: ${response.status} ${response.statusText}`,
      );
    } else {
      console.log('🔔 Discord notification sent successfully.');
    }
  } catch (error) {
    console.error('❌ Failed to send Discord notification:', error);
  }
}
