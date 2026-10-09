import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NO_INDEX } from '@/config/seo';
import { accessLifetime } from '@/lib/auth/session';
import { SessionKeeper } from '@/features/auth/session-keeper';
import { notFound } from 'next/navigation';
import { getPublicQuiz } from '@/lib/api/public-quiz';
import { ApiError } from '@/lib/api/client';

export const metadata: Metadata = {
  title: 'Quiz Invitation',
  description:
    'View a shared QuizMB quiz invitation. Sign in to register and participate.',
  robots: NO_INDEX,
};

/** Public quiz pages: a signed-in visitor's session is kept fresh too. */
export default async function PublicQuizLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Unknown quizzes 404 here, above the page's loading screen: once that
  // starts streaming, the response can no longer get a real 404 status.
  // The page and metadata reuse this request (React cache).
  try {
    await getPublicQuiz(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    // Other failures surface from the page's own error handling.
  }
  const lifetime = await accessLifetime();
  return (
    <>
      {lifetime && <SessionKeeper {...lifetime} />}
      {children}
    </>
  );
}
