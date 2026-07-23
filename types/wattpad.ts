/**
 * Wattpad API response types.
 *
 * Wattpad has no official public API. These shapes were confirmed by
 * hitting the real endpoints against a live public story during
 * development (api/v3/stories/{id} and the per-part text_url it returns).
 */

export interface WattpadStoryResponse {
  id: string;
  title: string;
  user: {
    name: string;
    username: string;
    avatar?: string;
  };
  parts: Array<{
    id: number;
    title: string;
    text_url: {
      text: string;
      refresh_token?: string;
    };
    /** ISO 8601 date string. Confirmed present in live testing, but not guaranteed for every story. */
    createDate?: string;
  }>;
}
