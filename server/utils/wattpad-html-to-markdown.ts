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

/**
 * Wattpad chapters carry inline `style="..."` (color, alignment, font-size)
 * that plain Markdown can't express. We also can't use pure HTML as that would
 * break the nuxt/mdc integration.
 * 
 * Instead, we use custom syntax/format to preserve the styling.
 * 
 * For example:
 * ```html
 * <p style="color: red; text-align: center;">Hello</p>
 * ```
 * becomes:
 * ```markdown
 * ::styled-html{tag="p" style="color: red; text-align: center;"}
 * Hello
 * ::
 * ```
 * 
 * See `StyledHtml.global.vue` for the component that renders this syntax.
 */
turndownService.addRule('styledInline', {
  filter: (node: any) => Boolean(node.getAttribute && node.getAttribute('style')),
  replacement: (content: string, node: any) => {
    const tag = node.nodeName.toLowerCase();
    const style = node.getAttribute('style');
    return `::styled-html{tag="${tag}" style="${style}"}\n${content}\n::\n`;
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
