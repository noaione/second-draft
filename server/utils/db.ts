import type { Node } from "comark";
import { createDatabase, type Primitive } from "db0";
import nodeSqlite3Connector from "db0/connectors/sqlite3";
import type { PostMetadata } from "~~/types/config";
import { SUPPORTED_MARKDOWN_VERSIONS } from "./versioning";
import type { MarkdownFormatVersion } from "./versioning";

const tableName = 'seconddraft_posts';

export function getDatabase(dbPath: string) {
  // Initiate database with SQLite connector
  const db = createDatabase(nodeSqlite3Connector({
    path: dbPath,
  }));
  return db;
}

export type DatabaseThing = ReturnType<typeof getDatabase>;

export type RenderedMarkdownResult = PostMetadata & { body: Node[], description: string, id: string; version: MarkdownFormatVersion };

function coercePrimitiveVersion(version: string): MarkdownFormatVersion {
  // Unknown version?
  const trim = version.trim();
  if (SUPPORTED_MARKDOWN_VERSIONS.includes(trim)) {
    return trim as MarkdownFormatVersion;
  }
  return 'v1';
}

function coercePrimitive(metadata: { [key: string]: unknown }): RenderedMarkdownResult {
  return {
    id: String(metadata.id),
    title: String(metadata.title),
    author: String(metadata.author),
    body: JSON.parse(String(metadata.body)),
    postId: String(metadata.postId),
    collectionId: String(metadata.collectionId),
    collectionName: String(metadata.collectionName),
    description: String(metadata.description ?? ''),
    publishedAt: String(metadata.publishedAt),
    version: coercePrimitiveVersion(String(metadata.version)),
  }
}

export async function getStoredPosts(db: DatabaseThing, collectionId: string, postId: string) {
  try {
    const singlePost = await db.sql`
      SELECT *
      FROM {${tableName}}
      WHERE collectionId = ${collectionId} AND postId = ${postId}
      LIMIT 1
    `;

    if (Array.isArray(singlePost.rows) && singlePost.rows.length > 0 && singlePost.rows[0]) {
      return coercePrimitive(singlePost.rows[0]);
    }
    return null;
  } catch (error) {
    console.error(`Error querying stored posts for collectionId ${collectionId} and postId ${postId}:`, error);
    return null;
  }
}

export async function deleteStoredPost(db: DatabaseThing, collectionId: string, postId: string): Promise<void> {
  await db.sql`
    DELETE FROM {${tableName}}
    WHERE collectionId = ${collectionId} AND postId = ${postId}
  `;
}

export async function storeRenderedMarkdown(db: DatabaseThing, result: Omit<RenderedMarkdownResult, 'id'>, path: string) {
  const stmt = db.prepare(`
    INSERT INTO ${tableName} (id, title, author, body, postId, collectionId, collectionName, description, publishedAt, version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(collectionId, postId) DO UPDATE SET
      title = excluded.title,
      author = excluded.author,
      body = excluded.body,
      collectionName = excluded.collectionName,
      description = excluded.description,
      publishedAt = excluded.publishedAt,
      version = excluded.version
  `);

  const values: Primitive[] = [
    `content/${path}`,
    result.title,
    result.author,
    JSON.stringify(result.body),
    result.postId,
    result.collectionId,
    result.collectionName,
    result.description ?? '',
    result.publishedAt,
    result.version,
  ];

  await stmt.run(...values);
}

export async function prepareDatabase(db: ReturnType<typeof getDatabase>) {
  // Create table if not exists
  await db.sql`
    CREATE TABLE IF NOT EXISTS {${tableName}} (
      "id" TEXT PRIMARY KEY NOT NULL,
      "title" TEXT NOT NULL,
      "author" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "postId" TEXT NOT NULL,
      "collectionId" TEXT NOT NULL,
      "collectionName" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "publishedAt" TEXT NOT NULL
    );
  `;

  // set unique index on collectionId and postId
  await db.sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_post
    ON {${tableName}}(collectionId, postId)
  `;

  // SQLite does not support `ADD COLUMN IF NOT EXISTS`. Check first, then
  // ignore only the duplicate-column race if two requests migrate together.
  const versionColumn = await db.sql<{ rows?: { name?: unknown }[] }>`
    SELECT name FROM pragma_table_info(${tableName}) WHERE name = 'version'
  `;

  if (!versionColumn.rows?.some((column) => column.name === 'version')) {
    try {
      await db.sql`
        ALTER TABLE {${tableName}}
        ADD COLUMN "version" TEXT NOT NULL DEFAULT 'v1'
      `;
    } catch (error) {
      if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) {
        throw error;
      }
    }
  }
}
