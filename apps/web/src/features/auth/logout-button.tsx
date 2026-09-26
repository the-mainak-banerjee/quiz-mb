'use client';
import { useState, type ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { Button, Text, type ButtonProps } from '@/components/ui';
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';
import { APP_LINKS } from '@/config/navigation';
export function LogoutButton({
  renderAction = (props) => <Button {...props} />,
}: {
  renderAction?: (props: ButtonProps) => ReactNode;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function logout() {
    setPending(true);
    setError('');
    try {
      await api.post(API_ROUTES.AUTH.LOGOUT);
      window.location.assign(APP_LINKS.AUTH.LOGIN);
    } catch (failure) {
      setError(apiError(failure).message);
      setPending(false);
    }
  }
  return (
    <div className="w-full">
      {renderAction({
        variant: 'danger',
        className: 'w-full',
        disabled: pending,
        onClick: logout,
        children: (
          <>
            <LogOut size={18} aria-hidden="true" />
            {pending ? 'Signing out…' : 'Logout'}
          </>
        ),
      })}
      {error && (
        <Text role="alert" variant="body-secondary" className="text-danger">
          {error}
        </Text>
      )}
    </div>
  );
}
