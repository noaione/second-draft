import type {
  PatreonPostsListResponse,
  PatreonPost,
  PatreonCampaign,
} from '../../types/patreon';

/**
 * Patreon API Client
 * Handles all interactions with the Patreon API v2
 */
export class PatreonClient {
  private sessionCookie: string;
  private baseUrl = 'https://www.patreon.com/api';
  private requestDelay = 100; // ms between requests to respect rate limits

  constructor(sessionCookie: string) {
    this.sessionCookie = sessionCookie;
  }

  /**
   * Make a request to the Patreon API with rate limiting and error handling
   */
  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'Cookie': this.sessionCookie,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0',
        'Referer': 'https://www.patreon.com/home',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Patreon API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, this.requestDelay));

    return response.json();
  }

  /**
   * Get campaign details
   */
  async getCampaign(campaignId: string): Promise<PatreonCampaign> {
    return this.request<PatreonCampaign>(
      `/campaigns/${campaignId}`,
      {
        'include': 'creator,channels',
        'fields[campaign]': 'created_at,creation_name,patron_count,url',
        'fields[user]': 'full_name,url',
      }
    );
  }

  /**
   * Get all posts for a campaign with pagination support
   */
  async getCampaignPosts(collectionId: string, campaignId: string): Promise<PatreonPostsListResponse['data']> {
    let allPosts: PatreonPostsListResponse['data'] = [];
    let cursor: string | undefined;

    do {
      console.log(`   Fetching posts page with cursor: ${cursor || 'start'}`);
      const params: Record<string, string> = {
        'filter[collection_id]': collectionId,
        'filter[campaign_id]': campaignId,
        'include': 'user,campaign',
        'fields[post]': 'title,content,published_at,url,post_type',
        'fields[user]': 'full_name,url',
        'page[count]': '100', // Max allowed
      };

      if (cursor) {
        params['page[cursor]'] = cursor;
      }

      const response = await this.request<PatreonPostsListResponse>('/posts', params);
      allPosts = allPosts.concat(response.data);

      cursor = response.meta?.pagination?.cursors?.next;
    } while (cursor);

    return allPosts;
  }

  /**
   * Get a single post by ID
   */
  async getPost(postId: string): Promise<PatreonPost> {
    return this.request<PatreonPost>(
      `/posts/${postId}`,
      {
        'include': 'user,campaign',
        'fields[post]': 'title,content,published_at,url,post_type',
        'fields[user]': 'full_name,url',
      }
    );
  }

  /**
   * Extract user information from included data
   */
  extractUserFromIncluded(
    included: Array<{ id: string; type: string; attributes: Record<string, any> }> | undefined,
    userId: string
  ): { full_name: string; url: string } | null {
    if (!included) return null;

    const user = included.find(item => item.type === 'user' && item.id === userId);
    if (!user) return null;

    return {
      full_name: user.attributes.full_name || 'Unknown',
      url: user.attributes.url || '',
    };
  }
}
