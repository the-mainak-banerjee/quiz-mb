import type { ReactNode } from 'react';
import { accessLifetime } from '@/lib/auth/session';
import { SessionKeeper } from '@/features/auth/session-keeper';

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
