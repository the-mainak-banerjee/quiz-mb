import StarterKit from '@tiptap/starter-kit';
import { MarkdownManager } from '@tiptap/markdown';
import { getSchema, type JSONContent } from '@tiptap/core';

/**
 * The formatting a question prompt may use, shared by the editor and every
 * read-only rendering so both always agree. Prompts are stored as Markdown.
 * Headings, links, images, underline (not Markdown) and horizontal rules are
 * left out: a prompt is a short question, links would send participants away
 * from a live quiz, and question images have their own upload.
 */
export const promptExtensions = [
  StarterKit.configure({
    heading: false,
    link: false,
    underline: false,
    horizontalRule: false,
  }),
];

const schema = getSchema(promptExtensions);
const manager = new MarkdownManager({ extensions: promptExtensions });

/**
 * Keeps only what the prompt schema allows. Markdown written elsewhere (or
 * pasted) may still contain headings, links, images or raw HTML: headings
 * become paragraphs, unknown marks are dropped (links become plain text) and
 * other unknown nodes keep only their allowed content.
 */
function clean(node: JSONContent): JSONContent[] {
  const type = node.type ?? '';
  const content = node.content?.flatMap(clean);
  if (type === 'text') {
    if (!node.text) return [];
    const marks = node.marks?.filter((mark) => schema.marks[mark.type]);
    return [{ ...node, ...(marks ? { marks } : {}) }];
  }
  if (schema.nodes[type]) return [{ ...node, ...(content ? { content } : {}) }];
  if (type === 'heading')
    return [{ type: 'paragraph', ...(content ? { content } : {}) }];
  return content ?? [];
}

const cache = new Map<string, JSONContent>();
const CACHE_LIMIT = 500;

/** Prompt Markdown as editor JSON, limited to the prompt schema (cached). */
export function parsePrompt(markdown: string): JSONContent {
  const cached = cache.get(markdown);
  if (cached) return cached;
  const parsed = manager.parse(markdown);
  const doc: JSONContent = {
    type: 'doc',
    content: (parsed.content ?? []).flatMap(clean),
  };
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(markdown, doc);
  return doc;
}

const plainText = (node: JSONContent): string =>
  node.text ?? (node.content ?? []).map(plainText).join(' ');

/** The first line of text in a block, descending into lists and quotes. */
function firstLineOf(node: JSONContent): JSONContent | null {
  if (node.type === 'codeBlock') {
    const line = plainText(node)
      .split('\n')
      .find((text) => text.trim());
    return line
      ? {
          type: 'paragraph',
          content: [
            { type: 'text', text: line.trim(), marks: [{ type: 'code' }] },
          ],
        }
      : null;
  }
  if (node.type === 'paragraph') {
    // A hard line break ends the first line.
    const content: JSONContent[] = [];
    for (const child of node.content ?? []) {
      if (child.type === 'hardBreak') break;
      content.push(child);
    }
    return content.some((child) => child.text?.trim())
      ? { type: 'paragraph', content }
      : null;
  }
  for (const child of node.content ?? []) {
    const line = firstLineOf(child);
    if (line) return line;
  }
  return null;
}

/**
 * The prompt's first line with its inline formatting, for one-line rows
 * (question lists). `more` is true when the prompt continues after it.
 */
export function promptFirstLine(markdown: string) {
  const doc = parsePrompt(markdown);
  let line: JSONContent | null = null;
  for (const block of doc.content ?? []) {
    line = firstLineOf(block);
    if (line) break;
  }
  const shown = line ? plainText(line).replace(/\s+/g, ' ').trim() : '';
  const all = plainText(doc).replace(/\s+/g, ' ').trim();
  return {
    doc: { type: 'doc', content: line ? [line] : [] } as JSONContent,
    more: all.length > shown.length,
  };
}
