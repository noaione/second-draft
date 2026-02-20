/**
 * Patreon `content_json_string` → Markdown parser
 *
 * Converts the Patreon rich-text JSON AST to a Markdown string via mdast.
 *
 * Supported node types:
 *   doc, paragraph, heading, blockquote, bulletList, orderedList, listItem,
 *   image, customImage, hardBreak, horizontalRule, text, video, audio,
 *   mention, paywallBreakpoint, cta
 *
 * Supported text marks:
 *   bold, italic, strike, underline (rendered as <u>…</u>), link
 */

import { toMarkdown } from 'mdast-util-to-markdown';
import type {
  Root,
  Paragraph,
  Heading,
  Blockquote,
  List,
  ListItem,
  Image,
  Break,
  ThematicBreak,
  Text,
  Strong,
  Emphasis,
  Delete,
  Link,
  Html,
  PhrasingContent,
  BlockContent,
  RootContent,
} from 'mdast';

// ---------------------------------------------------------------------------
// Patreon JSON types
// ---------------------------------------------------------------------------

export interface PatreonTextMark {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'link' | string;
  attrs?: {
    href?: string;
    target?: string;
    [key: string]: unknown;
  };
}

export interface PatreonNode {
  type: string;
  /** Plain text value – only present on `text` leaf nodes */
  text?: string;
  marks?: PatreonTextMark[];
  attrs?: Record<string, unknown>;
  content?: PatreonNode[];
}

export interface PatreonDoc {
  type: 'doc';
  content: PatreonNode[];
}

// ---------------------------------------------------------------------------
// Inline HTML helpers (needed for underline, which has no Markdown equivalent)
// ---------------------------------------------------------------------------

/** Serialise an mdast phrasing node to an HTML string (used when wrapping with <u>). */
function phrasingToHtml(node: PhrasingContent): string {
  switch (node.type) {
    case 'text':
      return escapeHtml((node as Text).value);
    case 'strong':
      return `<strong>${(node as Strong).children.map(phrasingToHtml).join('')}</strong>`;
    case 'emphasis':
      return `<em>${(node as Emphasis).children.map(phrasingToHtml).join('')}</em>`;
    case 'delete':
      return `<del>${(node as Delete).children.map(phrasingToHtml).join('')}</del>`;
    case 'link': {
      const l = node as Link;
      const href = escapeHtml(l.url);
      const inner = l.children.map(phrasingToHtml).join('');
      return `<a href="${href}">${inner}</a>`;
    }
    case 'html':
      return (node as Html).value;
    case 'break':
      return '<br>';
    default:
      return '';
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Mark application
// Applied from the END of the marks array inward (mirrors Patreon's reduceRight)
// ---------------------------------------------------------------------------

function applyMark(node: PhrasingContent, mark: PatreonTextMark): PhrasingContent {
  switch (mark.type) {
    case 'bold':
      return { type: 'strong', children: [node] } satisfies Strong;
    case 'italic':
      return { type: 'emphasis', children: [node] } satisfies Emphasis;
    case 'strike':
      return { type: 'delete', children: [node] } satisfies Delete;
    case 'link':
      return {
        type: 'link',
        url: String(mark.attrs?.href ?? ''),
        title: null,
        children: [node],
      } satisfies Link;
    case 'underline':
      // Markdown has no underline; render as inline HTML <u>…</u>
      return { type: 'html', value: `<u>${phrasingToHtml(node)}</u>` } satisfies Html;
    default:
      return node;
  }
}

function convertTextNode(node: PatreonNode): PhrasingContent {
  let result: PhrasingContent = { type: 'text', value: node.text ?? '' };

  if (node.marks?.length) {
    // Apply from end → start (matching Patreon's reduceRight behaviour)
    for (let i = node.marks.length - 1; i >= 0; i--) {
      result = applyMark(result, node.marks[i]!);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Block node converters
// ---------------------------------------------------------------------------

function convertChildren(nodes: PatreonNode[]): PhrasingContent[] {
  const out: PhrasingContent[] = [];
  for (const child of nodes) {
    const converted = convertInlineNode(child);
    if (converted !== null) out.push(converted);
  }
  return out;
}

/** Convert a node that is expected to produce inline (phrasing) content. */
function convertInlineNode(node: PatreonNode): PhrasingContent | null {
  switch (node.type) {
    case 'text':
      return convertTextNode(node);

    case 'hardBreak':
      return { type: 'break' } satisfies Break;

    case 'image':
    case 'customImage': {
      // Inline image (node_type !== 'block')
      const attrs = node.attrs ?? {};
      return {
        type: 'image',
        url: String(attrs.src ?? ''),
        alt: String(attrs.alt ?? ''),
        title: attrs.caption ? String(attrs.caption) : null,
      } satisfies Image;
    }

    case 'mention': {
      // Render the mention text if attrs contain a name, otherwise skip
      const name = node.attrs?.full_name ?? node.attrs?.name ?? '';
      return name ? ({ type: 'text', value: String(name) } satisfies Text) : null;
    }

    // Paywall / unknown inline – skip
    default:
      return null;
  }
}

/** Convert a node that produces block content. */
function convertBlockNode(node: PatreonNode): RootContent | null {
  switch (node.type) {
    // ── Paragraph ──────────────────────────────────────────────────────────
    case 'paragraph': {
      const children = convertChildren(node.content ?? []);
      if (children.length === 0) return null;
      return { type: 'paragraph', children } satisfies Paragraph;
    }

    // ── Heading ────────────────────────────────────────────────────────────
    case 'heading': {
      const children = convertChildren(node.content ?? []);
      return { type: 'heading', depth: 3, children } satisfies Heading;
    }

    // ── Blockquote ─────────────────────────────────────────────────────────
    case 'blockquote': {
      const children = convertBlockChildren(node.content ?? []) as BlockContent[];
      return { type: 'blockquote', children } satisfies Blockquote;
    }

    // ── Lists ──────────────────────────────────────────────────────────────
    case 'bulletList': {
      const items = convertListItems(node.content ?? []);
      return { type: 'list', ordered: false, children: items } satisfies List;
    }

    case 'orderedList': {
      const items = convertListItems(node.content ?? []);
      const start = node.attrs?.order != null ? Number(node.attrs.order) : 1;
      return { type: 'list', ordered: true, start, children: items } satisfies List;
    }

    // ── Image (block) ──────────────────────────────────────────────────────
    case 'image': {
      if (node.attrs?.node_type !== 'block') {
        // Inline image – wrap in a paragraph
        const img = convertInlineNode(node);
        return img ? { type: 'paragraph', children: [img] } : null;
      }

      const attrs = node.attrs ?? {};
      const imgNode: Image = {
        type: 'image',
        url: String(attrs.src ?? ''),
        alt: String(attrs.alt ?? ''),
        title: attrs.caption ? String(attrs.caption) : null,
      };

      // Wrap in a link if there's a custom link
      const linkUrl = attrs.link ? String(attrs.link) : null;
      const child: PhrasingContent = linkUrl
        ? { type: 'link', url: linkUrl, title: null, children: [imgNode] }
        : imgNode;

      return { type: 'paragraph', children: [child] } satisfies Paragraph;
    }

    case 'customImage': {
      const attrs = node.attrs ?? {};
      const imgNode: Image = {
        type: 'image',
        url: String(attrs.src ?? ''),
        alt: String(attrs.alt ?? ''),
        title: attrs.caption ? String(attrs.caption) : null,
      };

      const linkUrl = attrs.customLink ? String(attrs.customLink) : null;
      const child: PhrasingContent = linkUrl
        ? { type: 'link', url: linkUrl, title: null, children: [imgNode] }
        : imgNode;

      return { type: 'paragraph', children: [child] } satisfies Paragraph;
    }

    // ── Audio / Video ──────────────────────────────────────────────────────
    case 'audio':
    case 'video': {
      const mediaId =
        String(node.attrs?.media_id ?? node.attrs?.['data-media-id'] ?? '');
      const label = node.type === 'video' ? 'Video' : 'Audio';
      const children: PhrasingContent[] = mediaId
        ? [{ type: 'text', value: `[${label}: ${mediaId}]` }]
        : [{ type: 'text', value: `[${label}]` }];
      return { type: 'paragraph', children } satisfies Paragraph;
    }

    // ── CTA ────────────────────────────────────────────────────────────────
    case 'cta': {
      const buttonText = node.attrs?.button_text
        ? String(node.attrs.button_text)
        : 'Read more';
      const buttonLink = node.attrs?.button_link
        ? String(node.attrs.button_link)
        : null;

      const linkNode: PhrasingContent = buttonLink
        ? {
            type: 'link',
            url: buttonLink,
            title: null,
            children: [{ type: 'text', value: buttonText }],
          }
        : { type: 'text', value: buttonText };

      const children: PhrasingContent[] = [linkNode];

      if (node.attrs?.caption) {
        children.push({ type: 'text', value: ` — ${node.attrs.caption}` });
      }

      return { type: 'paragraph', children } satisfies Paragraph;
    }

    // ── Horizontal rule ────────────────────────────────────────────────────
    case 'horizontalRule':
      return { type: 'thematicBreak' } satisfies ThematicBreak;

    // ── Paywall / unknown block – skip ─────────────────────────────────────
    default:
      console.warn(`Unsupported block node type: ${node.type}`);
      return null;
  }
}

function convertBlockChildren(nodes: PatreonNode[]): RootContent[] {
  const out: RootContent[] = [];
  for (const child of nodes) {
    const converted = convertBlockNode(child);
    if (converted !== null) out.push(converted);
  }
  return out;
}

function convertListItems(nodes: PatreonNode[]): ListItem[] {
  return nodes
    .filter((n) => n.type === 'listItem')
    .map((n) => {
      const children = convertBlockChildren(n.content ?? []) as BlockContent[];
      return { type: 'listItem', children } satisfies ListItem;
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a Patreon `content_json_string` value and return Markdown.
 *
 * @param json - The raw JSON string from `post.attributes.content_json_string`
 * @returns Markdown string, or `null` if the input is empty / invalid
 */
export function patreonJsonToMarkdown(json: string | null | undefined): string | null {
  if (!json) return null;

  let doc: PatreonDoc;
  try {
    doc = JSON.parse(json) as PatreonDoc;
  } catch {
    return null;
  }

  if (doc.type !== 'doc' || !Array.isArray(doc.content)) return null;

  const root: Root = {
    type: 'root',
    children: convertBlockChildren(doc.content),
  };

  if (root.children.length === 0) return null;

  return toMarkdown(root, {
    bullet: '-',
    emphasis: '_',
    strong: '*',
    fence: '`',
  });
}
