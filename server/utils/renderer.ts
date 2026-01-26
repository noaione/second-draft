import { createShikiHighlighter, parseMarkdown, rehypeHighlight } from "@nuxtjs/mdc/runtime";
import materialThemePaleNight from 'shiki/themes/material-theme-palenight.mjs';
import { createDatabase, Primitive } from "db0";
import sqlite from "db0/connectors/sqlite3";
import { hash }  from 'ohash';

import bash from '@shikijs/langs/bash';
import html from '@shikijs/langs/html';
import mdc from '@shikijs/langs/mdc';
import vue from '@shikijs/langs/vue';
import yml from '@shikijs/langs/yml';
import scss from '@shikijs/langs/scss';
import ts from '@shikijs/langs/ts';
import typescript from '@shikijs/langs/typescript';
import { createOnigurumaEngine, Highlighter } from "shiki";

import { visit } from 'unist-util-visit';
import { fromHast } from "minimark/hast";
import { PostMetadata } from "~~/types/patreon";
import { MinimarkTree } from "minimark";

type HighlightedNode = { type: 'element', properties?: Record<string, string | undefined> }

let highlightPlugin: {
  instance: unknown
  key?: string
  options?: {
    theme?: Record<string, unknown>
    highlighter: Highlighter,
  }
} | undefined;

async function getHighlighter() {
  const highlighter = createShikiHighlighter({
    bundledLangs: {
      'bash': bash,
      'html': html,
      'mdc': mdc,
      'vue': vue,
      'yml': yml,
      'scss': scss,
      'ts': ts,
      'typescript': typescript,
    },
    bundledThemes: {
      'material-theme-palenight': materialThemePaleNight,
    },
    engine: createOnigurumaEngine(import('shiki/wasm')),
  });

  highlightPlugin = {
    key: 'shiki-highlighter',
    instance: rehypeHighlight,
    options: {
      // @ts-expect-error
      highlighter: async (code, lang, theme, opts) => {
        const result = await highlighter(code, lang, theme, opts)
        return result
      },
      theme: {
        'material-theme-palenight': materialThemePaleNight,
      },
    },
  }

  return highlightPlugin;  
}

type RenderedMarkdownResult = PostMetadata & { body: MinimarkTree, description: string };

export async function renderMarkdownToHtml(markdown: string): Promise<RenderedMarkdownResult> {
  const highlighterPlugin = highlightPlugin || await getHighlighter();

  const parsed = await parseMarkdown(markdown, {
    highlight: {
      theme: 'material-theme-palenight',
      // @ts-expect-error
      highlighter: highlighterPlugin!.options!.highlighter,
    },
    remark: {
      plugins: {
        'remark-emoji': {},
      },
    },
    rehype: {
      plugins: {},
    }
  })

  const comprssedBody = fromHast(parsed.body);
  const dataContent = parsed.data as PostMetadata & { description: string };
  console.log(`Rendered markdown for postId ${dataContent.postId} titled "${dataContent.title}"`);

  return {
    ...dataContent,
    body: comprssedBody,
  }
}

export async function storeRenderedMarkdown(result: RenderedMarkdownResult, path: string, dbPath: string) {
  // Initiate database with SQLite connector
  const db = createDatabase(sqlite({
    path: dbPath,
  }));

  const stmt = db.prepare(`
    INSERT INTO _content_content (id, title, author, body, postId, collectionId, collectionName, description, extension, meta, navigation, path, publishedAt, seo, stem, __hash__)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    'md',
    '{}',
    true,
    `/${path.replace('.md', '')}`,
    result.publishedAt,
    JSON.stringify({title: result.title, description: result.description}),
    path.replace('.md', ''),
  ];

  const hashValue = hash(values);
  values.push(hashValue);

  console.log(`Storing rendered markdown for ${path} with hash ${hashValue}`);
  const stmtResult = await stmt.run(...values);
  console.log(`Stored rendered markdown for ${path} with rowid ${stmtResult}`);
}
