import { requireUser } from '@/lib/auth/session';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { loadUserQuizData } from '@/features/dashboard/quiz-data';

export default async function DashboardPage() {
  const [user, data] = await Promise.all([requireUser(), loadUserQuizData()]);
  return (
    <DashboardView
      user={user}
      quizzes={data.quizzes}
      projects={data.projects}
    />
  );
}
