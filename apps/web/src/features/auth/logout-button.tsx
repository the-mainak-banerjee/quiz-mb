'use client';
import { useState } from 'react';
import { Button, Text } from '@/components/ui';
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';
export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setPending(true);
    setError('');
    try {
      await api.post(API_ROUTES.AUTH.LOGOUT);
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard authenticated router cache after revocation.
      window.location.assign('/login');
    } catch (failure) {
      setError(apiError(failure).message);
      setPending(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" disabled={pending} onClick={logout}>
        {pending ? 'Signing out…' : 'Logout'}
      </Button>
      {error && (
        <Text role="alert" variant="body-secondary" className="text-danger">
          {error}
        </Text>
      )}
    </div>
  );
}
