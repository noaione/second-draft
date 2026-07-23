/**
 * Configuration types for the Patreon content downloader
 */

export interface PatreonCollection {
  /** Local folder identifier (always required). Used as the directory name under `content/`. */
  id: string;
  /** Patreon tag slug. When provided, uses `filter[tag]` for the API query instead of `filter[collection_id]`. */
  tag?: string;
  name: string;
  campaignId: string;
  complete?: boolean;
}

export interface PatreonConfig {
  sessionCookie: string;
  collections: PatreonCollection[];
}

export interface WattpadCollection {
  /** Wattpad story id — also doubles as the source identifier (no separate local-folder id, unlike Patreon) */
  id: string;
  name: string;
  complete?: boolean;
}

export interface WattpadConfig {
  /** Optional — only needed for mature/paywalled stories */
  sessionCookie?: string;
  collections: WattpadCollection[];
}

export interface AppConfig {
  password: string;
  /** Independent, optional source blocks — either, both, or neither may be configured */
  patreon?: PatreonConfig;
  wattpad?: WattpadConfig;
  /** Optional Discord webhook for sync notifications */
  discord?: {
    webhookUrl: string;
  };
}

/**
 * Content source a collection/sync result originated from.
 */
export type ContentMode = 'patreon' | 'wattpad';

/**
 * Collection metadata stored in index.json
 */
export interface CollectionMetadata {
  id: string;
  name: string;
  /** Patreon campaign id, or Wattpad story id for Wattpad-sourced collections */
  campaignId: string;
  lastSync: string; // ISO 8601 date string
  postCount: number;
  author?: string;
  posts?: PostMetadata[];
  mode: ContentMode;
}

/**
 * Post metadata (frontmatter in markdown files)
 */
export interface PostMetadata {
  title: string;
  postId: string;
  publishedAt: string; // ISO 8601 date string
  author: string;
  collectionName: string;
  collectionId: string;
}

/**
 * Patreon API response types
 */

export interface PatreonUser {
  data: {
    id: string;
    type: 'user';
    attributes: {
      full_name: string;
      url: string;
    };
  };
}

export interface PatreonPostAttributes {
  title: string;
  content: string;
  /** Structured rich-text JSON (preferred over `content` HTML) */
  content_json_string?: string | null;
  published_at: string;
  url: string;
  post_type: string;
  current_user_can_view: boolean;
}

export interface PatreonPostRelationships {
  campaign: {
    data: {
      id: string;
      type: 'campaign';
    };
  };
  user: {
    data: {
      id: string;
      type: 'user';
    };
  };
}

export interface PatreonPost {
  data: {
    id: string;
    type: 'post';
    attributes: PatreonPostAttributes;
    relationships: PatreonPostRelationships;
  };
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, any>;
  }>;
}

export interface PatreonPostsListResponse {
  data: Array<{
    id: string;
    type: 'post';
    attributes: PatreonPostAttributes;
    relationships: PatreonPostRelationships;
  }>;
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, any>;
  }>;
  meta?: {
    pagination: {
      total: number;
      cursors?: {
        next?: string;
      };
    };
  };
}

export interface PatreonCampaign {
  data: {
    id: string;
    type: 'campaign';
    attributes: {
      created_at: string;
      creation_name: string;
      patron_count: number;
      url: string;
    };
    relationships: {
      creator: {
        data: {
          id: string;
          type: 'user';
        };
      };
    };
  };
  included?: Array<{
    id: string;
    type: string;
    attributes: Record<string, any>;
  }>;
}
