import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Circle } from 'lucide-react';
import { Text } from '@/components/ui';
import { MiloStage } from '@/components/milo/milo-states';
import { Brand as Wordmark } from '@/components/brand';
import { cn } from '@/lib/utils';
import { APP_LINKS } from '@/config/navigation';
import { authLink } from '@/lib/auth/return-to';
import { AuthForm } from './auth-form';

function Brand() {
  return (
    <Link
      href={APP_LINKS.HOME}
      prefetch={false}
      className="ds-focus inline-flex items-center"
    >
      <Wordmark />
    </Link>
  );
}

function StatusDot() {
  return <Circle aria-hidden="true" size={7} fill="currentColor" />;
}

/** Real product screens (captured from the app with sample data). */
const SCREENSHOTS = {
  login: {
    src: '/auth/host-console.webp',
    width: 1440,
    height: 920,
    alt: 'The QuizMB host console during a live question: the question list, live answer breakdown and quiz controls.',
    caption:
      'The host console: ask any question, watch answers arrive and decide when to show the leaderboard.',
  },
  signup: {
    src: '/auth/participant-question.webp',
    width: 1200,
    height: 1007,
    alt: 'A participant answering a live QuizMB question, with the countdown and answer options.',
    caption:
      'What participants see: one question at a time, a countdown and a single submit.',
  },
} as const;

function Preview({ signup }: { signup: boolean }) {
  const previewTone = signup ? 'inverse' : 'primary';
  const shot = signup ? SCREENSHOTS.signup : SCREENSHOTS.login;

  return (
    <aside
      aria-label="Platform introduction"
      className={cn(
        'flex flex-col rounded-feature p-space-lg md:p-space-xl',
        signup ? 'bg-action-primary' : 'bg-surface-low',
      )}
    >
      <div className="space-y-space-md rounded-card p-space-md">
        <Text
          as="span"
          variant="caption"
          tone={previewTone}
          className={cn(
            'flex w-fit items-center gap-space-xs rounded-md px-2 py-1',
            signup ? 'bg-surface/10' : 'bg-surface text-action-primary',
          )}
        >
          <StatusDot />
          {signup ? 'Interactive Team Sessions' : 'Platform Philosophy'}
        </Text>
        <Text
          as="h2"
          variant={signup ? 'section-heading' : 'page-title'}
          tone={previewTone}
        >
          {signup
            ? 'Bringing teams and communities together through lively, thoughtful quizzes.'
            : '“Designed for focused live engagement. Minimal distraction, deliberate interaction, and effortless control.”'}
        </Text>
        {signup && (
          <Text variant="body-secondary" tone="inverse">
            Host engaging trivia nights, team standups, study circles, and
            community meetups without the chaotic noise. Easy to host,
            effortless to join, and fun for everyone.
          </Text>
        )}
      </div>

      {/* Top padding leaves room for Milo above the screenshot. */}
      <figure className="space-y-space-sm pt-space-xl md:pt-space-2xl">
        <div className="relative">
          <div className="overflow-hidden rounded-card border border-border-surface bg-surface shadow-floating">
            <Image
              src={shot.src}
              width={shot.width}
              height={shot.height}
              alt={shot.alt}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="h-auto w-full"
              priority
            />
          </div>
          {/* Milo greets from the corner of the product screenshot. */}
          <MiloStage
            pose="welcome"
            className="absolute -top-16 right-space-sm w-24 md:-top-20 md:w-28"
          />
        </div>
        <figcaption>
          <Text variant="caption" tone={previewTone}>
            {shot.caption}
          </Text>
        </figcaption>
      </figure>
    </aside>
  );
}

export function AuthPage({
  mode,
  returnTo,
}: {
  mode: 'login' | 'signup';
  returnTo: string;
}) {
  const signup = mode === 'signup';

  return (
    <main className="mx-auto flex min-h-screen max-w-content items-center px-margin-sm py-space-xl md:px-margin lg:px-margin-lg lg:py-space-2xl">
      <div
        className={cn(
          'grid w-full grid-cols-1 gap-space-xl lg:grid-cols-12 lg:gap-space-2xl',
          signup ? 'items-stretch' : 'items-center',
        )}
      >
        <section
          className={cn(
            'min-w-0',
            signup
              ? 'rounded-feature bg-surface-low p-space-lg md:p-space-xl lg:col-span-7'
              : 'lg:col-span-6',
          )}
        >
          <div className="mb-space-xl">
            <Brand />
          </div>
          <div className="mb-space-xl space-y-space-xs">
            <Text as="h1" variant="display">
              {signup ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text tone="secondary">
              {signup
                ? 'Start hosting thoughtful live quizzes with your team and community.'
                : 'Enter your credentials to access your live quiz sessions and workspaces.'}
            </Text>
          </div>
          <AuthForm mode={mode} returnTo={returnTo} />
          <Text
            variant="body-secondary"
            tone="secondary"
            className="mt-space-xl flex flex-wrap items-center justify-between gap-space-sm"
          >
            <span>
              {signup ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <Link
              href={authLink(
                signup ? APP_LINKS.AUTH.LOGIN : APP_LINKS.AUTH.SIGNUP,
                returnTo,
              )}
              prefetch={false}
              className="ds-focus inline-flex items-center gap-space-xs text-label text-accent underline-offset-4 hover:text-action-primary hover:underline"
            >
              {signup ? 'Sign in' : 'Create an account'}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </Text>
        </section>
        <div
          className={cn(
            'grid min-w-0',
            signup ? 'lg:col-span-5' : 'lg:col-span-6',
          )}
        >
          <Preview signup={signup} />
        </div>
      </div>
    </main>
  );
}
