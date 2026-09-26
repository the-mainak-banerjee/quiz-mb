import type { ReactNode } from 'react';
import { WorkspaceHeader } from './workspace-header';
import { WorkspaceFooter } from './workspace-footer';
import { PreviewProvider } from '@/contexts/preview-context';

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <PreviewProvider>
      <div className="flex min-h-screen flex-col">
        <WorkspaceHeader />
        {children}
        <WorkspaceFooter />
      </div>
    </PreviewProvider>
  );
}
