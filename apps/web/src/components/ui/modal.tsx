'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-var(--spacing-margin))] w-[calc(100%-var(--spacing-margin))] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-border-surface bg-surface p-space-md shadow-floating md:p-space-lg">
          <div className="mb-space-md flex items-start justify-between gap-space-sm">
            <div className="space-y-space-xs">
              <Dialog.Title asChild>
                <Text as="h2" variant="section-heading">
                  {title}
                </Text>
              </Dialog.Title>
              <Dialog.Description asChild>
                <Text variant="body-secondary" tone="secondary">
                  {description}
                </Text>
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                className="px-space-xs"
                icon={<X size={18} />}
              >
                <VisuallyHidden>Close dialog</VisuallyHidden>
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
