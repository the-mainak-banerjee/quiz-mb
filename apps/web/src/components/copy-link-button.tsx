'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui';

/** Copies a shareable quiz link and briefly confirms success. */
export function CopyLinkButton({
  url,
  label = 'Copy link',
  variant = 'secondary',
  className,
}: {
  url: string;
  label?: string;
  variant?: Exclude<ButtonProps['variant'], 'primary' | undefined>;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button
      variant={variant}
      className={className}
      icon={
        copied ? (
          <Check size={18} aria-hidden="true" />
        ) : (
          <Copy size={18} aria-hidden="true" />
        )
      }
      onClick={() => void copy()}
    >
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </Button>
  );
}
