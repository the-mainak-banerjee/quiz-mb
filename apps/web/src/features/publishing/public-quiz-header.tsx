import { PublicHeader } from '@/components/workspace/public-header';
import type { CurrentUser } from '@/lib/auth/session';
import { APP_LINKS } from '@/config/navigation';

export function PublicQuizHeader({
  user,
  quizSlug,
}: {
  user: CurrentUser | null;
  quizSlug: string;
}) {
  return (
    <PublicHeader user={user} returnTo={APP_LINKS.PUBLIC_QUIZ(quizSlug)} />
  );
}
