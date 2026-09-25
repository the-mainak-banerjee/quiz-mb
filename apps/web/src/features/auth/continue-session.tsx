'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Text } from '@/components/ui';
import { refreshSession } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';

export function ContinueSession() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function resume() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await refreshSession();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard cached server content after cookie rotation.
      window.location.assign('/');
    } catch (failure) {
      const result = apiError(failure);
      if (result.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Cookies have been cleared by Express.
        window.location.assign('/login');
        return;
      }
      setError(result.message);
      setPending(false);
    }
  }
  return (
    <div className="space-y-space-md">
      <Button onClick={resume} disabled={pending}>
        {pending ? 'Continuing…' : 'Continue session'}
      </Button>
      {error && (
        <Text role="alert" className="text-danger">
          {error}
        </Text>
      )}
      <Text>
        <Link
          href="/login"
          prefetch={false}
          className="ds-focus text-accent underline"
        >
          Sign in again
        </Link>
      </Text>
    </div>
  );
}
