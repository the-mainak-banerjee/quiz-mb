import Link from 'next/link';
import { Brand } from '@/components/brand';
import { WorkspaceHeader } from '@/components/workspace/workspace-header';
import { CurrentUserProvider } from '@/contexts/current-user-context';
import type { CurrentUser } from '@/lib/auth/session';
import { APP_LINKS } from '@/config/navigation';
import { authLink } from '@/lib/auth/return-to';

export function PublicQuizHeader({
  user,
  quizSlug,
}: {
  user: CurrentUser | null;
  quizSlug: string;
}) {
  if (user) {
    return (
      <CurrentUserProvider initialUser={user}>
        <WorkspaceHeader />
      </CurrentUserProvider>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-surface bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-content items-center justify-between gap-space-sm px-margin-sm py-space-xs md:px-margin lg:px-space-xl">
        <Link
          href={APP_LINKS.HOME}
          aria-label="QuizMB home"
          className="ds-focus"
        >
          <Brand />
        </Link>
        <Link
          href={authLink(APP_LINKS.AUTH.LOGIN, APP_LINKS.PUBLIC_QUIZ(quizSlug))}
          className="ds-focus ds-control-motion inline-flex h-control items-center justify-center rounded-control border border-border-surface bg-surface px-control-x text-label hover:border-accent hover:bg-canvas"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}
