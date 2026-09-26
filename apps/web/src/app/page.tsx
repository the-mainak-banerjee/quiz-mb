import Link from 'next/link';
import { Text, Surface } from '@/components/ui';
import { APP_LINKS } from '@/config/navigation';
export default function HomePage() {
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
          Thoughtful live quizzes for teams and communities.
        </Text>
        <Surface>
          <Text tone="secondary">
            Create an account or sign in to explore your workspace. Quiz
            creation and live participation are not available yet.
          </Text>
        </Surface>
        <nav aria-label="Get started" className="flex flex-wrap gap-space-md">
          <Link
            href={APP_LINKS.WORKSPACE.DASHBOARD}
            className="ds-focus text-label text-accent underline"
          >
            Go to dashboard
          </Link>
          <Link
            href={APP_LINKS.AUTH.LOGIN}
            className="ds-focus text-label text-accent underline"
          >
            Sign in
          </Link>
          <Link
            href={APP_LINKS.AUTH.SIGNUP}
            className="ds-focus text-label text-accent underline"
          >
            Create account
          </Link>
        </nav>
      </section>
    </main>
  );
}
