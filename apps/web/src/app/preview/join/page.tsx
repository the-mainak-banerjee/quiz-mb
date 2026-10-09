import type { Metadata } from 'next';
import { currentUser } from '@/lib/auth/session';
import { PreviewJoinPage } from '@/features/landing/preview-join';

export const metadata: Metadata = {
  title: 'Participant preview · QuizMB',
  description: 'See what learners experience when they open a QuizMB invitation.',
};

export default async function JoinPreviewRoute() {
  const user = await currentUser(false);
  return <PreviewJoinPage user={user} />;
}
