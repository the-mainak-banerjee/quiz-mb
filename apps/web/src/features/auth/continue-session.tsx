'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button, Text } from '@/components/ui';
import { refreshSession } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { APP_LINKS } from '@/config/navigation';

export function ContinueSession() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function resume() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await refreshSession();
      window.location.assign(APP_LINKS.WORKSPACE.DASHBOARD);
    } catch (failure) {
      const result = apiError(failure);
      if (result.status === 401) {
        window.location.assign(APP_LINKS.AUTH.LOGIN);
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
          href={APP_LINKS.AUTH.LOGIN}
          prefetch={false}
          className="ds-focus text-accent underline"
        >
          Sign in again
        </Link>
      </Text>
    </div>
  );
}
