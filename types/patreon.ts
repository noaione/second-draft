/**
 * Configuration types for the Patreon content downloader
 */

export interface PatreonCollection {
  id: string;
  name: string;
  campaignId: string;
  complete?: boolean;
}

export interface PatreonConfig {
  sessionCookie: string;
  collections: PatreonCollection[];
}

export interface AppConfig {
  password: string;
  patreon: PatreonConfig;
}

/**
 * Collection metadata stored in index.json
 */
export interface CollectionMetadata {
  id: string;
  name: string;
  campaignId: string;
  lastSync: string; // ISO 8601 date string
  postCount: number;
  posts?: PostMetadata[];
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
