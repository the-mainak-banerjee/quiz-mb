import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NO_INDEX } from '@/config/seo';
import { accessLifetime } from '@/lib/auth/session';
import { SessionKeeper } from '@/features/auth/session-keeper';

export const metadata: Metadata = {
  title: 'Quiz Invitation',
  description:
    'View a shared QuizMB quiz invitation. Sign in to register and participate.',
  robots: NO_INDEX,
};

/** Public quiz pages: a signed-in visitor's session is kept fresh too. */
export default async function PublicQuizLayout({
  children,
}: {
  children: ReactNode;
}) {
  const lifetime = await accessLifetime();
  return (
    <>
      {lifetime && <SessionKeeper {...lifetime} />}
      {children}
    </>
  );
}
