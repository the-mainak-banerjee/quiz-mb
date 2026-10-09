import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, LockKeyhole } from 'lucide-react';
import { Avatar, Button, Surface, Text } from '@/components/ui';
import { WorkspaceFooter } from '@/components/workspace/workspace-footer';
import { APP_LINKS } from '@/config/navigation';
import type { CurrentUser } from '@/lib/auth/session';
import { LandingNav } from './sections';
import { Eyebrow } from './sections';

function QuizDetailsPreview() {
  return (
    <div className="space-y-space-md rounded-feature border border-border-surface bg-canvas p-space-sm shadow-floating sm:p-space-lg">
      <div className="flex flex-wrap items-center gap-space-xs">
        <span className="inline-flex items-center gap-space-xs rounded-pill bg-status-scheduled-surface px-badge-x py-badge-y text-badge text-status-scheduled-text">
          <span className="size-status-dot rounded-pill bg-current" aria-hidden="true" />
          Registration open
        </span>
        <Text variant="caption" tone="secondary">
          AI Fundamentals Cohort
        </Text>
      </div>
      <Text as="h2" variant="display" className="text-balance">
        AI Fundamentals: Weekly Challenge
      </Text>
      <Text tone="secondary" className="max-w-2xl">
        A short live quiz to recap this week’s concepts and compare notes with
        your cohort.
      </Text>
      <div className="flex items-center gap-space-sm">
        <Avatar name="QuizMB Teaching Team" size="medium" />
        <div>
          <Text variant="label">QuizMB Teaching Team</Text>
          <Text variant="caption" tone="secondary">Quiz host</Text>
        </div>
      </div>
      <Surface className="grid gap-space-sm bg-surface-low md:grid-cols-3">
        <div>
          <Text variant="caption" tone="secondary" className="flex items-center gap-space-xs">
            <CalendarDays size={16} aria-hidden="true" /> Date
          </Text>
          <Text variant="label" className="mt-space-xs">Thursday, 15 Oct 2026</Text>
        </div>
        <div>
          <Text variant="caption" tone="secondary" className="flex items-center gap-space-xs">
            <Clock3 size={16} aria-hidden="true" /> Time
          </Text>
          <Text variant="label" className="mt-space-xs">6:30 pm IST</Text>
        </div>
        <div>
          <Text variant="caption" tone="secondary" className="flex items-center gap-space-xs">
            <LockKeyhole size={16} aria-hidden="true" /> Location
          </Text>
          <Text variant="label" className="mt-space-xs">Online live room</Text>
        </div>
      </Surface>
      <Surface className="flex flex-col gap-space-sm bg-surface-low sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Text variant="label">Participant registration</Text>
          <Text variant="body-secondary" tone="secondary">
            Sign in to register for the live quiz.
          </Text>
        </div>
        <Button disabled className="shrink-0">Preview only</Button>
      </Surface>
    </div>
  );
}

export function PreviewJoinPage({ user }: { user: CurrentUser | null }) {
  const ctaHref = user ? APP_LINKS.WORKSPACE.DASHBOARD : APP_LINKS.AUTH.SIGNUP;
  const ctaLabel = user ? 'Go to dashboard' : 'Create your first quiz';

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <LandingNav user={user} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-content px-margin-sm py-section-sm md:px-margin md:py-section lg:px-space-xl lg:py-section">
          <section className="mx-auto max-w-3xl space-y-space-md text-center">
            <Eyebrow>Participant preview</Eyebrow>
            <Text as="h1" variant="display" className="text-balance">
              Your quiz invitation starts here.
            </Text>
            <Text tone="secondary" className="text-pretty">
              When learners scan your QR code or open your shared link, they
              arrive at your quiz details page. They can see what the quiz is
              about, who’s hosting it, and when it’s planned.
            </Text>
            <Text tone="secondary">Here’s an example of what that page looks like.</Text>
          </section>

          <section aria-label="Example quiz details" className="mx-auto mt-space-xl max-w-4xl">
            <QuizDetailsPreview />
            <Text variant="caption" tone="secondary" className="mt-space-sm block text-center">
              Example preview — this isn’t a live quiz.
            </Text>
          </section>

          <section className="mx-auto mt-section-sm max-w-2xl space-y-space-sm text-center">
            <Text as="h2" variant="display" className="text-balance">
              From invitation to participation
            </Text>
            <Text tone="secondary" className="text-pretty">
              Your learners sign in or create an account to register. When you
              open the lobby, they can enter and wait for you to start.
            </Text>
          </section>

          <section className="mx-auto mt-section-sm max-w-2xl rounded-feature bg-action-primary px-space-lg py-space-xl text-center text-action-on-primary sm:px-space-2xl">
            <Text as="h2" variant="display" className="text-balance text-action-on-primary">
              Ready to host a quiz of your own?
            </Text>
            <Text className="mt-space-sm text-pretty text-text-inverse/80">
              Create your first quiz and get a shareable link and QR code to
              invite your learners.
            </Text>
            <div className="mt-space-lg flex flex-col justify-center gap-space-sm sm:flex-row">
              <Link
                href={ctaHref}
                className="ds-focus ds-control-motion inline-flex h-control-large items-center justify-center gap-space-xs rounded-control bg-surface px-space-md text-label text-action-primary shadow-raised hover:bg-action-secondary"
              >
                {ctaLabel}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link
                href={APP_LINKS.AUTH.LOGIN}
                className="ds-focus inline-flex h-control-large items-center justify-center rounded-control border border-text-inverse/30 px-space-md text-label text-action-on-primary hover:bg-action-primary-hover"
              >
                Already have an account? Log in
              </Link>
            </div>
          </section>

          <div className="mt-space-xl text-center flex justify-center">
            <Link href={APP_LINKS.HOME} className="ds-focus text-label text-accent underline-offset-4 hover:underline w-fit flex items-center gap-space-xs">
              <ArrowLeft size={18} />
              Back to Home page
            </Link>
          </div>
        </div>
      </main>
      <WorkspaceFooter />
    </div>
  );
}
