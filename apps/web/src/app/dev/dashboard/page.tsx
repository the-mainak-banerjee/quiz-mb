import { notFound } from 'next/navigation';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { CurrentUserProvider } from '@/contexts/current-user-context';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import {
  quizzes,
  projects,
  upcomingQuiz,
} from '@/features/dashboard/mock-data';

// Static fixture preview for responsive UI work, never available in production.
export default async function DashboardPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const populated = (await searchParams).state === 'populated';
  const user = {
    id: 'preview',
    name: 'Elena Rostova',
    email: 'elena@example.com',
    avatarUrl: null,
  };
  return (
    <CurrentUserProvider initialUser={user}>
      <WorkspaceShell>
        <DashboardView
          user={user}
          quizzes={populated ? quizzes : []}
          projects={populated ? projects : []}
          upcomingQuiz={populated ? upcomingQuiz : null}
        />
      </WorkspaceShell>
    </CurrentUserProvider>
  );
}
