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

import { fromHast } from "minimark/hast";
import { PostMetadata } from "~~/types/patreon";
import { RenderedMarkdownResult } from "./db";

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

export async function renderMarkdownToHtml(markdown: string): Promise<Omit<RenderedMarkdownResult, 'id'>> {
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

  return {
    ...dataContent,
    body: comprssedBody,
  }
}
