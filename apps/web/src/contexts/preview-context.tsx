'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';

const PreviewContext = createContext<(action: string) => void>(() => {});

export function PreviewProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState('');

  return (
    <PreviewContext.Provider
      value={(action) =>
        setNotice(
          `${action} is not available yet. This feature is a UI preview.`,
        )
      }
    >
      {children}
      {notice && (
        <div className="fixed bottom-space-md inset-x-margin-sm z-50 mx-auto flex max-w-content items-center justify-between gap-space-sm rounded-card border border-border-surface bg-surface p-space-sm shadow-floating md:inset-x-margin">
          <Text role="status" variant="body-secondary">
            {notice}
          </Text>
          <Button variant="ghost" onClick={() => setNotice('')}>
            <X size={18} aria-hidden="true" />
            <VisuallyHidden>Dismiss message</VisuallyHidden>
          </Button>
        </div>
      )}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  return useContext(PreviewContext);
}
