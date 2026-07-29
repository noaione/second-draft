import type { WattpadStoryResponse } from '../../types/wattpad';

/**
 * Wattpad API client.
 * Handles fetching story metadata and chapter text from Wattpad's
 * unofficial (but stable, verified live) endpoints.
 */
export class WattpadClient {
  private sessionCookie?: string;
  private baseUrl = 'https://www.wattpad.com';
  private requestDelay = 100; // ms between requests, courtesy rate limiting

  constructor(sessionCookie?: string) {
    this.sessionCookie = sessionCookie;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:147.0) Gecko/20100101 Firefox/147.0',
    };
    if (this.sessionCookie) {
      headers['Cookie'] = this.sessionCookie;
    }
    return headers;
  }

  private async delay(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, this.requestDelay));
  }

  /**
   * Get story metadata, including the full list of parts (chapters).
   * Each part carries a `text_url.text` — the URL to fetch that part's
   * body from directly, rather than constructing an endpoint manually.
   */
  async getStory(storyId: string): Promise<WattpadStoryResponse> {
    const url = new URL(`${this.baseUrl}/api/v3/stories/${storyId}`);
    url.searchParams.set('fields', 'id,title,user(name,username,avatar),parts(id,title,text_url,createDate)');

    const response = await fetch(url.toString(), { headers: this.headers() });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Wattpad API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    await this.delay();

    return response.json();
  }

  /**
   * Fetch a chapter's body HTML from the URL provided by `getStory`'s
   * `part.text_url.text` — never hand-build this URL.
   */
  async getPartText(textUrl: string): Promise<string> {
    const response = await fetch(textUrl, { headers: this.headers() });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Wattpad API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    await this.delay();

    return response.text();
  }

  /**
   * Lightweight lookup of just a story's author (no `parts`, unlike `getStory`).
   */
  async getStoryAuthor(storyId: string): Promise<{ username: string; name: string }> {
    const url = new URL(`${this.baseUrl}/api/v3/stories/${storyId}`);
    url.searchParams.set('fields', 'user(name,username)');

    const response = await fetch(url.toString(), { headers: this.headers() });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Wattpad API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    await this.delay();

    const data: { user: { username: string; name: string } } = await response.json();
    return data.user;
  }

  /**
   * List every published story for a user. Paginates internally via the
   * API's own `nextUrl` (mirrors PatreonClient.getCampaignPosts) — this
   * endpoint lives on a different host (`api.wattpad.com`, not
   * `www.wattpad.com`), confirmed live during development.
   */
  async getUserPublishedStories(username: string): Promise<Array<{ id: string; title: string; completed: boolean }>> {
    const stories: Array<{ id: string; title: string; completed: boolean }> = [];
    let url: string | null =
      `https://api.wattpad.com/v4/users/${encodeURIComponent(username)}/stories/published?fields=stories(id,title,completed),total,nextUrl`;

    while (url) {
      const response = await fetch(url, { headers: this.headers() });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Wattpad API error: ${response.status} ${response.statusText}\n${errorText}`);
      }

      await this.delay();

      const page: { stories: Array<{ id: string; title: string; completed: boolean }>; nextUrl: string | null } = await response.json();
      stories.push(...page.stories);
      url = page.nextUrl;
    }

    return stories;
  }
}
