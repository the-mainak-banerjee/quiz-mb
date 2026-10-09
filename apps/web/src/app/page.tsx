import type { Metadata } from 'next';
import { LandingFinal } from '@/features/landing/final/landing-final';
import { currentUser } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'QuizMB · Live quizzes for cohort courses',
  description:
    'Bring your learners together with interactive live quizzes for courses, cohorts and learning communities.',
};

export default async function HomePage() {
  // The homepage stays public, including when an access token has expired.
  const user = await currentUser(false);
  return <LandingFinal user={user} />;
}
