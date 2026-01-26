import { createDatabase, Primitive } from "db0";
import nodeSqlite3Connector from "db0/connectors/sqlite3";
import { MinimarkTree } from "minimark";
import { PostMetadata } from "~~/types/patreon";

const tableName = 'seconddraft_posts';

export function getDatabase(dbPath: string) {
  // Initiate database with SQLite connector
  const db = createDatabase(nodeSqlite3Connector({
    path: dbPath,
  }));
  return db;
}

export type DatabaseThing = ReturnType<typeof getDatabase>;

export type RenderedMarkdownResult = PostMetadata & { body: MinimarkTree, description: string, id: string };

function coercePrimitive(metadata: { [key: string]: unknown }): RenderedMarkdownResult {
  return {
    id: String(metadata.id),
    title: String(metadata.title),
    author: String(metadata.author),
    body: JSON.parse(String(metadata.body)) as MinimarkTree,
    postId: String(metadata.postId),
    collectionId: String(metadata.collectionId),
    collectionName: String(metadata.collectionName),
    description: String(metadata.description),
    publishedAt: String(metadata.publishedAt),
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

export async function storeRenderedMarkdown(db: DatabaseThing, result: Omit<RenderedMarkdownResult, 'id'>, path: string) {
  const stmt = db.prepare(`
    INSERT INTO ${tableName} (id, title, author, body, postId, collectionId, collectionName, description, publishedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const values: Primitive[] = [
    `content/${path}`,
    result.title,
    result.author,
    JSON.stringify(result.body),
    result.postId,
    result.collectionId,
    result.collectionName,
    result.description,
    result.publishedAt,
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
}