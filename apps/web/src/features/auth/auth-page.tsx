import Link from 'next/link';
import { ArrowRight, Check, Circle, PartyPopper, Zap } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { Brand as Wordmark } from '@/components/brand';
import { cn } from '@/lib/utils';
import { AuthForm } from './auth-form';

function Brand() {
  return (
    <Link
      href="/"
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

function Preview({ signup }: { signup: boolean }) {
  const previewTone = signup ? 'inverse' : 'primary';

  return (
    <aside
      aria-label="Platform introduction"
      className={cn(
        'flex flex-col justify-between gap-space-xl rounded-feature p-space-lg md:p-space-xl',
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

      {signup ? (
        <div className="space-y-space-md rounded-card bg-surface/10 p-space-md">
          <div className="flex flex-wrap justify-between gap-space-xs">
            <Text
              as="span"
              variant="label"
              tone="inverse"
              className="flex items-center gap-space-xs"
            >
              <StatusDot /> Friday Team Trivia #42
            </Text>
            <Text as="span" variant="caption" tone="inverse">
              48 players active
            </Text>
          </div>
          <div className="grid grid-cols-2 gap-space-sm">
            <div className="rounded-control bg-surface/5 p-space-sm">
              <Text variant="caption" tone="inverse">
                Active teams
              </Text>
              <Text variant="card-title" tone="inverse">
                8 Groups{' '}
                <Text as="span" variant="caption" tone="inverse">
                  active
                </Text>
              </Text>
            </div>
            <div className="rounded-control bg-surface/5 p-space-sm">
              <Text variant="caption" tone="inverse">
                Current round
              </Text>
              <Text variant="card-title" tone="inverse">
                Round 3 of 5
              </Text>
            </div>
          </div>
          <Text
            variant="caption"
            tone="inverse"
            className="flex flex-wrap justify-between gap-space-xs"
          >
            <span className="flex items-center gap-space-xs">
              <StatusDot /> Designers &amp; Writers
            </span>
            <span className="flex items-center gap-space-xs">
              All locked in! <PartyPopper aria-hidden="true" size={14} />
            </span>
          </Text>
          <Text
            variant="caption"
            tone="inverse"
            className="flex flex-wrap justify-between gap-space-xs"
          >
            <span className="flex items-center gap-space-xs">
              <StatusDot /> Frontend Crew
            </span>
            <span>Discussing option B...</span>
          </Text>
        </div>
      ) : (
        <Surface>
          <div className="flex justify-between gap-space-sm text-accent">
            <Text
              as="span"
              variant="caption"
              className="flex items-center gap-space-xs text-accent"
            >
              <StatusDot /> Live Ready
            </Text>
            <Text as="span" variant="caption" className="text-accent">
              42 joined
            </Text>
          </div>
          <Text as="h3" variant="card-title" className="mt-space-sm">
            Product All-Hands Q3
          </Text>
          <Text variant="body-secondary" tone="secondary">
            Quarterly sync &amp; knowledge check
          </Text>
          <div className="mt-space-md flex justify-between gap-space-sm">
            <Text as="span" variant="caption">
              EM · LR · KA · +39
            </Text>
            <Text as="span" variant="caption" className="text-accent">
              Session 08 / 12
            </Text>
          </div>
        </Surface>
      )}

      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        {signup ? (
          <>
            <Text as="span" variant="caption" tone="inverse">
              MK · DR · AS
            </Text>
            <Text as="span" variant="caption" tone="inverse">
              Loved by 2,500+ teams, study groups &amp; communities
            </Text>
          </>
        ) : (
          <>
            <Text
              as="span"
              variant="caption"
              className="flex items-center gap-space-xs"
            >
              <Check aria-hidden="true" size={14} /> End-to-end encrypted
            </Text>
            <Text
              as="span"
              variant="caption"
              className="flex items-center gap-space-xs"
            >
              <Zap aria-hidden="true" size={14} /> Instant live responses
            </Text>
          </>
        )}
      </div>
    </aside>
  );
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
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
          <AuthForm mode={mode} />
          <Text
            variant="body-secondary"
            tone="secondary"
            className="mt-space-xl flex flex-wrap items-center justify-between gap-space-sm"
          >
            <span>
              {signup ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <Link
              href={signup ? '/login' : '/signup'}
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
