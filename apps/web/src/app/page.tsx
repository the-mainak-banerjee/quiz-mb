import { requireUser } from '@/lib/auth/session';
import { LogoutButton } from '@/features/auth/logout-button';
import { Text, Surface } from '@/components/ui';
export default async function HomePage() {
  const user = await requireUser();
  return (
    <main className="mx-auto max-w-content px-margin-sm py-space-2xl md:px-margin lg:px-margin-lg">
      <section className="space-y-space-md">
        <Text variant="label" tone="secondary">
          QuizMB · Foundation
        </Text>
        <Text as="h1" variant="display">
          A home for live quizzes.
        </Text>
        <Text tone="secondary">
          Signed in as {user.name} ({user.email}).
        </Text>
        <Surface>
          <Text tone="secondary">
            Your account is ready. Quiz creation and live participation are not
            available yet.
          </Text>
        </Surface>
        <LogoutButton />
      </section>
    </main>
  );
}
