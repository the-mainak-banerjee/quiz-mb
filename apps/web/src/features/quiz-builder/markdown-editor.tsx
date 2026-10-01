'use client';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { Bold, Italic, Code, List } from 'lucide-react';
import { Button, Text } from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/visually-hidden';
const Preview = dynamic(() => import('@/components/markdown-preview'), {
  loading: () => <Text tone="secondary">Loading preview…</Text>,
});
export function MarkdownEditor({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  function insert(before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart,
      end = el.selectionEnd;
    onChange(
      value.slice(0, start) +
        before +
        (value.slice(start, end) || 'text') +
        after +
        value.slice(end),
    );
    el.focus();
  }
  return (
    <div className="space-y-space-xs">
      <label htmlFor="question-prompt" className="text-label">
        Question prompt *
      </label>
      <div className="rounded-control border border-border-control bg-surface">
        <div className="flex flex-wrap items-center gap-space-xs border-b border-border-surface p-space-xs">
          {[
            { label: 'Bold', Icon: Bold, before: '**', after: '**' },
            { label: 'Italic', Icon: Italic, before: '*', after: '*' },
            { label: 'Code', Icon: Code, before: '`', after: '`' },
            { label: 'List', Icon: List, before: '\n- ', after: '' },
          ].map(({ label, Icon, before, after }) => (
            <Button
              key={label}
              variant="ghost"
              className="px-space-xs"
              icon={<Icon size={18} />}
              disabled={preview}
              onClick={() => insert(before, after)}
            >
              <VisuallyHidden>{label}</VisuallyHidden>
            </Button>
          ))}
          <Button
            variant="ghost"
            className="ml-auto"
            aria-pressed={preview}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? 'Write' : 'Preview'}
          </Button>
        </div>
        {preview ? (
          <div className="p-space-md">
            <Preview text={value} />
          </div>
        ) : (
          <Textarea
            ref={ref}
            id="question-prompt"
            rows={7}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? 'question-prompt-error' : undefined}
            className="border-0"
          />
        )}
      </div>
      <Text variant="caption" tone="secondary">
        Markdown supported · {value.length} characters
      </Text>
      {error && (
        <Text id="question-prompt-error" role="alert" className="text-danger">
          {error}
        </Text>
      )}
    </div>
  );
}
