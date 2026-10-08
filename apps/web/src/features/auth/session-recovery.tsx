'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Text } from '@/components/ui';
import { PageLoader } from '@/components/milo/milo-states';
import { refreshSession } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { authLink } from '@/lib/auth/return-to';
import { APP_LINKS } from '@/config/navigation';

/**
 * Renews an expired session in the browser (only it holds the refresh
 * cookie) and returns to the page being opened, without asking. A refused
 * renewal goes to sign-in (see refreshSession); only a network failure
 * stays here, with a retry.
 */
export function SessionRecovery({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [error, setError] = useState('');

  const renew = useCallback(
    () =>
      refreshSession()
        .then(() => router.replace(returnTo))
        .catch((failure: unknown) => {
          const result = apiError(failure);
          // 401: already on its way to sign-in.
          if (result.status !== 401) setError(result.message);
        }),
    [returnTo, router],
  );

  useEffect(() => {
    void renew();
  }, [renew]);

  function retry() {
    setError('');
    void renew();
  }

  if (!error) return <PageLoader label="Restoring your session…" />;
  return (
    <main className="mx-auto max-w-content space-y-space-md px-margin-sm py-space-2xl">
      <Text as="h1" variant="page-title">
        We couldn’t restore your session
      </Text>
      <Text role="alert" className="text-danger">
        {error}
      </Text>
      <div className="flex flex-wrap items-center gap-space-md">
        <Button onClick={retry}>Try again</Button>
        <Link
          href={authLink(APP_LINKS.AUTH.LOGIN, returnTo)}
          prefetch={false}
          className="ds-focus text-label text-accent underline"
        >
          Sign in again
        </Link>
      </div>
    </main>
  );
}
