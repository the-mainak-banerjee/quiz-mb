'use client';
import { useEffect, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Markdown } from '@tiptap/markdown';
import {
  Bold,
  Code,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { AUTHORING_LIMITS } from '@quizmb/contracts';
import { Button, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { PromptText, promptContentClass } from '@/components/markdown-preview';
import {
  parsePrompt,
  promptExtensions,
} from '@/components/markdown/prompt-markdown';
import { cn } from '@/lib/utils';

const extensions = [...promptExtensions, Markdown];

function ToolButton({
  label,
  shortcut,
  icon,
  active = false,
  disabled = false,
  onClick,
}: {
  label: string;
  shortcut?: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      className={cn(
        'px-space-xs',
        active && 'bg-action-secondary text-accent hover:bg-action-secondary',
      )}
      icon={icon}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      disabled={disabled}
      // Keep the selection in the editor while clicking the toolbar.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <VisuallyHidden>{label}</VisuallyHidden>
    </Button>
  );
}

/**
 * Question prompt editor: formatting shows as you type (no Markdown
 * symbols), with undo and redo. The value is stored as Markdown, limited to
 * the formatting every prompt display supports (see prompt-markdown.ts).
 */
export function MarkdownEditor({
  value,
  onChange,
  error,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  /** Show the rendered prompt only, with no editing toolbar. */
  readOnly?: boolean;
}) {
  const editor = useEditor(
    {
      extensions,
      content: parsePrompt(value),
      immediatelyRender: false,
      editable: !readOnly,
      editorProps: {
        attributes: {
          id: 'question-prompt',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-labelledby': 'question-prompt-label',
          ...(error
            ? {
                'aria-invalid': 'true',
                'aria-describedby': 'question-prompt-error',
              }
            : {}),
          class: cn(
            promptContentClass,
            'min-h-40 space-y-space-sm p-space-md text-body text-text-primary outline-none [&_li]:my-1 [&_ol]:pl-space-md [&_ul]:pl-space-md',
          ),
        },
      },
      onUpdate: ({ editor: current }) => {
        // An emptied editor is an empty prompt, not a blank paragraph.
        onChange(current.isEmpty ? '' : current.getMarkdown());
      },
    },
    [readOnly],
  );

  // Follow outside changes (form reset, switching questions) without
  // fighting the editor's own updates.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.isEmpty ? '' : editor.getMarkdown();
    if (current !== value)
      editor.commands.setContent(parsePrompt(value), { emitUpdate: false });
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            strike: current.isActive('strike'),
            code: current.isActive('code'),
            bulletList: current.isActive('bulletList'),
            orderedList: current.isActive('orderedList'),
            blockquote: current.isActive('blockquote'),
            codeBlock: current.isActive('codeBlock'),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  });

  if (readOnly)
    return (
      <div className="space-y-space-xs">
        <Text variant="label">Question prompt</Text>
        <div className="rounded-control border border-border-control bg-surface p-space-md">
          <PromptText text={value} className="text-body text-text-primary" />
        </div>
      </div>
    );

  const chain = () => editor?.chain().focus();
  const tools = [
    {
      label: 'Bold',
      shortcut: 'Ctrl+B',
      icon: <Bold size={18} />,
      active: state?.bold,
      run: () => chain()?.toggleBold().run(),
    },
    {
      label: 'Italic',
      shortcut: 'Ctrl+I',
      icon: <Italic size={18} />,
      active: state?.italic,
      run: () => chain()?.toggleItalic().run(),
    },
    {
      label: 'Strikethrough',
      shortcut: 'Ctrl+Shift+S',
      icon: <Strikethrough size={18} />,
      active: state?.strike,
      run: () => chain()?.toggleStrike().run(),
    },
    {
      label: 'Inline code',
      shortcut: 'Ctrl+E',
      icon: <Code size={18} />,
      active: state?.code,
      run: () => chain()?.toggleCode().run(),
    },
    {
      label: 'Bulleted list',
      shortcut: 'Ctrl+Shift+8',
      icon: <List size={18} />,
      active: state?.bulletList,
      run: () => chain()?.toggleBulletList().run(),
    },
    {
      label: 'Numbered list',
      shortcut: 'Ctrl+Shift+7',
      icon: <ListOrdered size={18} />,
      active: state?.orderedList,
      run: () => chain()?.toggleOrderedList().run(),
    },
    {
      label: 'Quote',
      shortcut: 'Ctrl+Shift+B',
      icon: <Quote size={18} />,
      active: state?.blockquote,
      run: () => chain()?.toggleBlockquote().run(),
    },
    {
      label: 'Code block',
      shortcut: 'Ctrl+Alt+C',
      icon: <SquareCode size={18} />,
      active: state?.codeBlock,
      run: () => chain()?.toggleCodeBlock().run(),
    },
  ];

  return (
    <div className="space-y-space-xs">
      <Text as="span" variant="label" id="question-prompt-label">
        Question prompt *
      </Text>
      <div
        className={cn(
          'rounded-control border border-border-control bg-surface focus-within:border-accent focus-within:shadow-focus',
          error && 'border-danger',
        )}
      >
        <div
          role="toolbar"
          aria-label="Formatting"
          aria-controls="question-prompt"
          className="flex flex-wrap items-center gap-1 border-b border-border-surface p-space-xs"
        >
          {tools.map((tool) => (
            <ToolButton
              key={tool.label}
              label={tool.label}
              shortcut={tool.shortcut}
              icon={tool.icon}
              active={tool.active ?? false}
              disabled={!editor}
              onClick={tool.run}
            />
          ))}
          <span
            aria-hidden="true"
            className="mx-1 h-5 w-px bg-border-surface"
          />
          <ToolButton
            label="Undo"
            shortcut="Ctrl+Z"
            icon={<Undo2 size={18} />}
            disabled={!state?.canUndo}
            onClick={() => chain()?.undo().run()}
          />
          <ToolButton
            label="Redo"
            shortcut="Ctrl+Shift+Z"
            icon={<Redo2 size={18} />}
            disabled={!state?.canRedo}
            onClick={() => chain()?.redo().run()}
          />
        </div>
        <EditorContent editor={editor} />
      </div>
      <Text
        variant="caption"
        tone="secondary"
        className={cn(
          'tabular-nums',
          value.length > AUTHORING_LIMITS.prompt && 'text-danger',
        )}
      >
        {value.length.toLocaleString()} /{' '}
        {AUTHORING_LIMITS.prompt.toLocaleString()} characters (including
        formatting)
      </Text>
      {error && (
        <Text id="question-prompt-error" role="alert" className="text-danger">
          {error}
        </Text>
      )}
    </div>
  );
}
