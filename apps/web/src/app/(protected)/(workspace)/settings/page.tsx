import type { Metadata } from 'next';
import { SettingsView } from '@/features/settings/settings-view';

export const metadata: Metadata = { title: 'Settings' };

// Signed-in only: the protected layout checks the session and provides the
// current user to the forms.
export default function SettingsPage() {
  return <SettingsView />;
}
