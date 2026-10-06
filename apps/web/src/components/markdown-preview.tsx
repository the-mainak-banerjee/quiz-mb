import { renderToReactElement } from '@tiptap/static-renderer/pm/react';
import {
  parsePrompt,
  promptExtensions,
  promptFirstLine,
} from '@/components/markdown/prompt-markdown';
import { cn } from '@/lib/utils';

/** Styles for rendered prompt content; the base text size comes from `className`. */
export const promptContentClass =
  'break-words [&_code]:rounded-sm [&_code]:bg-surface-low [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em] [&_pre]:overflow-x-auto [&_pre]:rounded-control [&_pre]:bg-surface-low [&_pre]:p-space-sm [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-space-sm [&_ul]:list-disc [&_ol]:list-decimal [&_li_p]:my-0';

/**
 * Renders a question prompt (stored as Markdown) with its formatting, from
 * the same schema the editor uses. Pure rendering: no editor instance, so it
 * is cheap enough for long lists and renders on the server too.
 * `compact` shows only the first line (with its inline formatting) for
 * list rows, and an ellipsis when the prompt continues.
 */
export function PromptText({
  text,
  className,
  compact = false,
}: {
  text: string;
  className?: string | undefined;
  compact?: boolean;
}) {
  if (compact) {
    const { doc, more } = promptFirstLine(text);
    return (
      <div
        className={cn(
          promptContentClass,
          'line-clamp-2 [&_p]:inline',
          className,
        )}
      >
        {renderToReactElement({ content: doc, extensions: promptExtensions })}
        {more && <span aria-hidden="true"> …</span>}
      </div>
    );
  }
  return (
    <div
      className={cn(
        promptContentClass,
        'space-y-space-sm [&_li]:my-1 [&_ol]:pl-space-md [&_ul]:pl-space-md',
        className,
      )}
    >
      {renderToReactElement({
        content: parsePrompt(text),
        extensions: promptExtensions,
      })}
    </div>
  );
}

/** Default export kept for the existing lazy imports. */
export default function MarkdownPreview({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <PromptText
      text={text}
      className={cn('text-body text-text-primary', className)}
    />
  );
}
