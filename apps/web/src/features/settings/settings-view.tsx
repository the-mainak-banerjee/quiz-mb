import { Text } from '@/components/ui';
import { DeleteAccount } from './delete-account';
import { PasswordCard } from './password-card';
import { ProfileCard } from './profile-card';

/** Account settings: profile, password and the danger zone. */
export function SettingsView() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-space-xl px-margin-sm py-space-lg md:px-margin">
      <div className="space-y-space-xs">
        <Text as="h1" variant="page-title">
          Settings
        </Text>
        <Text tone="secondary">Manage your profile and account security.</Text>
      </div>
      <ProfileCard />
      <PasswordCard />
      <DeleteAccount />
    </main>
  );
}
