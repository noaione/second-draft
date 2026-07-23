import sanitizeHtml from 'sanitize-html';
import TurndownService from 'turndown';

const ALLOWED_TAGS = [
  'p', 'span', 'div',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'mark', 'sup', 'sub',
  'br', 'blockquote', 'a',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'img',
];

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      '*': ['style'],
      a: ['href'],
      img: ['src', 'alt'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
    },
  });
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Wattpad chapters carry inline `style="..."` (color, alignment, font-size)
// that plain Markdown can't express. Re-wrap any element that has a style
// attribute as raw HTML instead of losing it to turndown's default plain-
// text handling — @nuxtjs/mdc passes raw HTML in Markdown through untouched.
// `node` is a turndown/domino DOM-like element, not a browser DOM node — the
// server tsconfig has no `dom` lib, so `getAttribute`/`nodeName` are typed as `any`.
turndownService.addRule('styledInline', {
  filter: (node: any) => Boolean(node.getAttribute && node.getAttribute('style')),
  replacement: (content: string, node: any) => {
    const tag = node.nodeName.toLowerCase();
    const style = node.getAttribute('style');
    return `<${tag} style="${style}">${content}</${tag}>`;
  },
});

/**
 * Convert Wattpad chapter HTML to Markdown, preserving inline styling
 * (color, alignment, etc.) as raw HTML where Markdown syntax can't
 * express it. Untrusted input is sanitized first to close the XSS
 * surface opened by re-embedding raw HTML.
 */
export function wattpadHtmlToMarkdown(html: string): string {
  const sanitized = sanitize(html);
  return turndownService.turndown(sanitized);
}
