import { createMarkdownParser, parseMarkdown } from 'comark';
import shiki from 'comark/plugins/shiki';
import security from 'comark/plugins/security';
import emoji from 'comark/plugins/emoji';
import materialThemePaleNight from '@shikijs/themes/material-theme-palenight';
import materialThemeOcean from '@shikijs/themes/material-theme-ocean';

import bash from '@shikijs/langs/bash';
import html from '@shikijs/langs/html';
import mdc from '@shikijs/langs/mdc';
import vue from '@shikijs/langs/vue';
import yml from '@shikijs/langs/yml';
import scss from '@shikijs/langs/scss';
import ts from '@shikijs/langs/ts';
import typescript from '@shikijs/langs/typescript';
import json from '@shikijs/langs/json';
import jsonc from '@shikijs/langs/jsonc';
import json5 from '@shikijs/langs/json5';

import type { PostMetadata } from "~~/types/config";
import type { RenderedMarkdownResult } from "./db";
import { CURRENT_MARKDOWN_FORMAT } from './versioning';

function getHighlighter() {
  const highlighter = shiki({
    languages: [
      bash,
      html,
      mdc,
      vue,
      yml,
      scss,
      ts,
      typescript,
      json,
      json5,
      jsonc,
    ],
    themes: {
      light: materialThemePaleNight,
      dark: materialThemeOcean,
    },
  });

  return highlighter;  
}

const globalParser = createMarkdownParser({
  plugins: [
    getHighlighter(),
    security({
      blockedTags: ['script', 'iframe'],
      allowedProtocols: ['https', 'mailto']
    }),
    emoji(),
  ],
});

export async function renderMarkdownToHtml(markdown: string): Promise<Omit<RenderedMarkdownResult, 'id'>> {
  const document = await globalParser(markdown);

  const dataContent = document.frontmatter as PostMetadata & { description: string };

  return {
    ...dataContent,
    body: document.nodes,
    version: CURRENT_MARKDOWN_FORMAT,
  }
}
