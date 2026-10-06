import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import { MarkdownManager } from '@tiptap/markdown';
import {
  parsePrompt,
  promptExtensions,
} from '../src/components/markdown/prompt-markdown.ts';

const html = (markdown) =>
  renderToStaticMarkup(
    renderToReactElement({
      content: parsePrompt(markdown),
      extensions: promptExtensions,
    }),
  );

test('prompt formatting renders as real elements, not Markdown symbols', () => {
  assert.equal(
    html('**Bold**, *italic*, ~~gone~~ and `code`'),
    '<p><strong>Bold</strong>, <em>italic</em>, <s>gone</s> and <code>code</code></p>',
  );
  assert.equal(
    html('- one\n- two\n\n1. first'),
    '<ul><li><p>one</p></li><li><p>two</p></li></ul><ol><li><p>first</p></li></ol>',
  );
  assert.equal(html(''), '');
});

test('headings, links, images and raw HTML never reach a prompt display', () => {
  const output = html(
    '# Title\n\n[site](https://evil.example)\n\n![pic](https://x/y.png)\n\n<script>alert(1)</script>',
  );
  assert.equal(output.includes('<h1'), false, 'headings become paragraphs');
  assert.equal(output.includes('<a'), false, 'links become plain text');
  assert.equal(output.includes('<img'), false, 'images are dropped');
  assert.equal(output.includes('<script'), false, 'HTML is shown as text');
  assert.match(output, /&lt;script&gt;/);
  assert.match(output, /<p>Title<\/p>/);
});

test('stored Markdown round-trips unchanged through the prompt schema', () => {
  const manager = new MarkdownManager({ extensions: promptExtensions });
  for (const markdown of [
    '**Bold** and *italic*',
    'Use `npm install` first',
    '- one\n- two',
  ])
    assert.equal(manager.serialize(parsePrompt(markdown)), markdown);
});

test('list rows show only the first line, with its inline formatting', async () => {
  const { promptFirstLine } =
    await import('../src/components/markdown/prompt-markdown.ts');
  const line = (markdown) => {
    const { doc, more } = promptFirstLine(markdown);
    return {
      html: renderToStaticMarkup(
        renderToReactElement({ content: doc, extensions: promptExtensions }),
      ),
      more,
    };
  };
  assert.deepEqual(
    line(
      'Who is ***the Prime Minister*** of ***India***?\n\n`let name = "Mainak"`\n\n```\nfunction getName(){\n  console.log("Name")\n}\n```\n\n> This is a quote.',
    ),
    {
      html: '<p>Who is <em><strong>the Prime Minister</strong></em> of <em><strong>India</strong></em>?</p>',
      more: true,
    },
  );
  assert.deepEqual(line('Just one line'), {
    html: '<p>Just one line</p>',
    more: false,
  });
  assert.deepEqual(line('- first item\n- second'), {
    html: '<p>first item</p>',
    more: true,
  });
  assert.deepEqual(line('```\n\nconst a = 1;\nmore()\n```'), {
    html: '<p><code>const a = 1;</code></p>',
    more: true,
  });
  assert.deepEqual(line(''), { html: '', more: false });
});
