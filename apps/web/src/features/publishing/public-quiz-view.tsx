'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  FolderOpen,
  Info,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  TicketCheck,
  UserMinus,
} from 'lucide-react';
import { Button, Surface, Text } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { WorkspaceFooter } from '@/components/workspace/workspace-footer';
import { APP_LINKS } from '@/config/navigation';
import type { CurrentUser } from '@/lib/auth/session';
import { apiError } from '@/lib/api/client';
import { publishingApi } from '@/lib/api/publishing';
import { authLink } from '@/lib/auth/return-to';
import { cn, getInitials, pluralize } from '@/lib/utils';
import type { PublicQuizState, PublishedQuizViewModel } from './types';
import { useQuizStatus } from './use-quiz-status';
import { PublicQuizHeader } from './public-quiz-header';
import { QuizCover } from './quiz-cover';
import { QUIZ_STATUS } from '@quizmb/contracts';

function SessionFacts({ quiz }: { quiz: PublishedQuizViewModel }) {
  const facts = [
    { label: 'Date', value: quiz.date, Icon: CalendarDays },
    {
      label: 'Time',
      value: quiz.time,
      Icon: Clock3,
    },
    { label: 'Location', value: 'Online live room', Icon: LockKeyhole },
  ];
  return (
    <dl className="grid gap-space-sm md:grid-cols-3">
      {facts.map(({ label, value, Icon }) => (
        <div key={label} className="rounded-control bg-surface-low p-space-sm">
          <dt className="flex items-center gap-space-xs text-caption text-text-secondary">
            <Icon size={16} aria-hidden="true" />
            {label}
          </dt>
          <dd className="mt-space-xs text-label text-text-primary">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Availability({
  quiz,
  full = false,
}: {
  quiz: PublishedQuizViewModel;
  full?: boolean;
}) {
  const registered = full ? quiz.registrationLimit : quiz.registeredCount;
  const remaining = quiz.registrationLimit - registered;
  return (
    <div className="space-y-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <Text variant="label">Cohort attendance capacity</Text>
        <Text variant="caption" tone="secondary">
          {registered} / {quiz.registrationLimit} registered
        </Text>
      </div>
      <div
        role="progressbar"
        aria-label="Registration capacity"
        aria-valuenow={registered}
        aria-valuemin={0}
        aria-valuemax={quiz.registrationLimit}
        className="h-space-xs overflow-hidden rounded-pill bg-surface-muted"
      >
        <div
          className="h-full rounded-pill bg-accent"
          style={{
            width: `${(registered / quiz.registrationLimit) * 100}%`,
          }}
        />
      </div>
      <Text variant="caption" tone="secondary">
        {remaining
          ? `${remaining} ${pluralize(remaining, 'seat')} remaining`
          : 'No seats remaining'}
      </Text>
    </div>
  );
}

function CompletedPanel({
  quiz,
  registered,
  isHost,
}: {
  quiz: PublishedQuizViewModel;
  /** The signed-in visitor held a seat; their result is in their history. */
  registered: boolean;
  isHost: boolean;
}) {
  const link = isHost
    ? {
        href: APP_LINKS.WORKSPACE.QUIZ_RESULTS(quiz.id),
        label: 'View results',
      }
    : registered
      ? { href: APP_LINKS.WORKSPACE.HISTORY, label: 'View your result' }
      : null;
  return (
    <Surface className="space-y-space-md">
      <div className="flex items-start gap-space-sm">
        <Flag className="shrink-0 text-accent" aria-hidden="true" />
        <div>
          <Text as="h2" variant="section-heading">
            Quiz completed
          </Text>
          <Text variant="body-secondary" tone="secondary">
            {isHost
              ? 'You ended this quiz. Final scores and ranks are saved.'
              : registered
                ? 'This quiz has ended. Your final score and rank are saved in your history.'
                : 'This quiz has ended and is no longer accepting registrations.'}
          </Text>
        </div>
      </div>
      {link && (
        <Link
          href={link.href}
          className="ds-focus ds-control-motion ds-primary-motion inline-flex h-control w-full items-center justify-center gap-space-xs rounded-control bg-action-primary px-control-x text-label text-action-on-primary hover:bg-action-primary-hover"
        >
          {link.label}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      )}
    </Surface>
  );
}

function RegistrationPanel({
  quiz,
  state,
  onRegister,
  onUnregister,
  registering,
}: {
  quiz: PublishedQuizViewModel;
  state: Exclude<PublicQuizState, 'completed'>;
  onRegister: () => void;
  onUnregister: () => void;
  /** A registration request is in flight; blocks repeat clicks. */
  registering: boolean;
}) {
  if (state === 'registered') {
    const liveOpen =
      quiz.status === QUIZ_STATUS.LOBBY || quiz.status === QUIZ_STATUS.LIVE;
    return (
      <Surface className="space-y-space-md bg-action-secondary">
        <div className="flex items-start gap-space-sm">
          <CheckCircle2 className="shrink-0 text-accent" aria-hidden="true" />
          <div>
            <Text as="h2" variant="section-heading">
              You’re registered
            </Text>
            <Text variant="body-secondary" tone="secondary">
              Your registration is confirmed.
            </Text>
          </div>
        </div>
        <div className="space-y-space-sm rounded-control bg-surface p-space-sm">
          <div>
            <Text variant="label">Live quiz room admission</Text>
            <Text variant="body-secondary" tone="secondary">
              {liveOpen
                ? 'The host has opened the live room. Join now.'
                : 'Access appears here when the host opens the live room.'}
            </Text>
          </div>
          {liveOpen && (
            <Link
              href={APP_LINKS.PUBLIC_QUIZ_LIVE(quiz.slug)}
              className="ds-focus ds-control-motion ds-primary-motion inline-flex h-control w-full items-center justify-center gap-space-xs rounded-control bg-action-primary px-control-x text-label text-action-on-primary hover:bg-action-primary-hover"
            >
              Enter live room
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-space-xs">
          <Button
            variant="secondary"
            icon={<CalendarDays size={18} aria-hidden="true" />}
          >
            Add to calendar
          </Button>
          {quiz.status !== QUIZ_STATUS.LIVE && (
            <Button
              variant="ghost"
              icon={<UserMinus size={18} aria-hidden="true" />}
              onClick={onUnregister}
            >
              Unregister
            </Button>
          )}
        </div>
        <Text variant="caption" tone="secondary">
          Unregistration is available until the quiz starts.
        </Text>
      </Surface>
    );
  }

  if (state === 'full') {
    return (
      <Surface className="space-y-space-md">
        <Text as="h2" variant="section-heading">
          Registration full
        </Text>
        <Availability quiz={quiz} full />
        <div className="rounded-control bg-status-scheduled-surface p-space-sm">
          <Text variant="body-secondary" className="text-status-scheduled-text">
            If a participant cancels, their seat becomes available
            automatically.
          </Text>
        </div>
        <Button
          className="w-full"
          disabled
          icon={<LockKeyhole size={18} aria-hidden="true" />}
        >
          Registration closed
        </Button>
      </Surface>
    );
  }

  if (state === 'closed') {
    return (
      <Surface className="space-y-space-md">
        <div className="flex items-start gap-space-sm">
          <LockKeyhole
            className="shrink-0 text-text-secondary"
            aria-hidden="true"
          />
          <div>
            <Text as="h2" variant="section-heading">
              Enrollment window concluded
            </Text>
            <Text variant="body-secondary" tone="secondary">
              Registration has closed while the host prepares the event.
            </Text>
          </div>
        </div>
        <Button className="w-full" disabled>
          No longer accepting registrations
        </Button>
      </Surface>
    );
  }

  if (state === 'logged-out') {
    return (
      <Surface className="space-y-space-md">
        <Availability quiz={quiz} />
        <div className="flex items-start gap-space-xs rounded-control bg-surface-low p-space-sm">
          <LockKeyhole
            className="mt-badge-y shrink-0 text-accent"
            size={18}
            aria-hidden="true"
          />
          <Text variant="body-secondary" tone="secondary">
            Sign in or create a free account to secure your seat. You’ll return
            directly to this quiz after authentication.
          </Text>
        </div>
        <Link
          href={authLink(
            APP_LINKS.AUTH.LOGIN,
            APP_LINKS.PUBLIC_QUIZ(quiz.slug),
          )}
          className="ds-focus ds-control-motion ds-primary-motion inline-flex h-control w-full items-center justify-center gap-space-xs rounded-control bg-action-primary px-control-x text-label text-action-on-primary hover:bg-action-primary-hover"
        >
          <LogIn size={18} aria-hidden="true" />
          Sign in to register
        </Link>
      </Surface>
    );
  }

  return (
    <Surface className="space-y-space-md">
      <div>
        <Text as="h2" variant="section-heading">
          Reserve your participant seat
        </Text>
        <Text variant="body-secondary" tone="secondary">
          Free registration · Instant confirmation · One seat per account
        </Text>
      </div>
      <Availability quiz={quiz} />
      <Button
        className="w-full"
        icon={<TicketCheck size={18} aria-hidden="true" />}
        onClick={onRegister}
        disabled={registering}
        aria-busy={registering}
      >
        {registering ? 'Registering…' : 'Register for quiz'}
      </Button>
      <Text
        variant="caption"
        tone="secondary"
        className="flex items-center gap-space-xs"
      >
        <Info size={16} aria-hidden="true" />
        Duplicate registrations are not permitted.
      </Text>
    </Surface>
  );
}

export function PublicQuizView({
  quiz,
  initialState,
  user,
  isHost,
}: {
  quiz: PublishedQuizViewModel;
  initialState: PublicQuizState;
  user: CurrentUser | null;
  isHost: boolean;
}) {
  const [state, setState] = useState(initialState);
  const [registrationCount, setRegistrationCount] = useState(
    quiz.registeredCount,
  );
  const [unregisterOpen, setUnregisterOpen] = useState(false);
  const [pending, setPending] = useState<'register' | 'unregister' | null>(
    null,
  );
  const [hostNoticeOpen, setHostNoticeOpen] = useState(false);
  const [error, setError] = useState('');
  const signedIn = !!user;
  // Live lifecycle updates (lobby opened/closed, started, ended) for
  // signed-in visitors; completed quizzes cannot change any more.
  const status = useQuizStatus(
    quiz.id,
    quiz.status,
    signedIn && quiz.status !== QUIZ_STATUS.COMPLETED,
  );
  // Registration closes once the quiz is live; registered participants keep
  // their panel (with the live-room link) until the quiz completes.
  const completed = status === QUIZ_STATUS.COMPLETED;
  const lifecycleState: PublicQuizState = completed
    ? 'completed'
    : status === QUIZ_STATUS.LIVE && state !== 'registered'
      ? 'closed'
      : state;
  const visibleState =
    !signedIn && (lifecycleState === 'open' || lifecycleState === 'registered')
      ? 'logged-out'
      : lifecycleState;
  const currentQuiz = { ...quiz, status, registeredCount: registrationCount };

  async function register() {
    if (isHost) {
      setHostNoticeOpen(true);
      return;
    }
    if (pending) return;
    setPending('register');
    setError('');
    try {
      const registration = await publishingApi.register(quiz.id);
      setRegistrationCount(registration.registrationCount);
      setState('registered');
    } catch (cause) {
      setError(apiError(cause).message);
    } finally {
      setPending(null);
    }
  }

  async function unregister() {
    if (pending) return;
    setPending('unregister');
    setError('');
    try {
      const registration = await publishingApi.unregister(quiz.id);
      setRegistrationCount(registration.registrationCount);
      setState('open');
      setUnregisterOpen(false);
    } catch (cause) {
      setError(apiError(cause).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicQuizHeader user={user} quizSlug={quiz.slug} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-content px-margin-sm py-space-lg md:px-margin lg:px-space-xl lg:py-space-xl">
          <Link
            href={signedIn ? APP_LINKS.WORKSPACE.DASHBOARD : APP_LINKS.HOME}
            className="ds-focus mb-space-lg inline-flex items-center gap-space-xs rounded-control text-label text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {signedIn ? 'Back to quizzes' : 'Back to community'}
          </Link>
          <div className="grid items-start gap-gutter-lg lg:grid-cols-12">
            <div className="space-y-space-lg lg:col-span-8">
              <section className="space-y-space-md">
                <div className="flex flex-wrap items-center gap-space-xs">
                  <span
                    className={cn(
                      'inline-flex items-center gap-space-xs rounded-pill px-badge-x py-badge-y text-badge',
                      completed
                        ? 'bg-status-neutral-surface text-status-neutral-text'
                        : 'bg-status-scheduled-surface text-status-scheduled-text',
                    )}
                  >
                    <span
                      className="size-status-dot rounded-pill bg-current"
                      aria-hidden="true"
                    />
                    {completed
                      ? 'Quiz completed'
                      : visibleState === 'closed'
                        ? 'Registration closed'
                        : visibleState === 'full'
                          ? 'Registration full'
                          : visibleState === 'registered'
                            ? 'Registered'
                            : 'Registration open'}
                  </span>
                  <Text
                    variant="caption"
                    tone="secondary"
                    className="inline-flex items-center gap-space-xs"
                  >
                    <FolderOpen size={15} aria-hidden="true" />
                    {quiz.project}
                  </Text>
                </div>
                <Text as="h1" variant="display" className="max-w-4xl">
                  {quiz.title}
                </Text>
                <Text tone="secondary" className="max-w-3xl">
                  {quiz.description}
                </Text>
                <QuizCover cover={quiz.cover} title={quiz.title} />
                <div className="flex items-center gap-space-sm">
                  <div className="flex size-control-large items-center justify-center rounded-pill bg-action-primary text-action-on-primary">
                    {getInitials(quiz.host)}
                  </div>
                  <div>
                    <Text variant="label">{quiz.host}</Text>
                    <Text variant="caption" tone="secondary">
                      Quiz host
                    </Text>
                  </div>
                </div>
              </section>
              <Surface>
                <SessionFacts quiz={quiz} />
              </Surface>
              <Surface className="flex items-start gap-space-sm bg-surface-low">
                <ShieldCheck
                  className="shrink-0 text-accent"
                  aria-hidden="true"
                />
                <div>
                  <Text variant="label">Verified community session</Text>
                  <Text variant="body-secondary" tone="secondary">
                    Synchronous participation and a guided analytical debrief
                    keep the cohort focused.
                  </Text>
                </div>
              </Surface>
            </div>
            <aside className="space-y-space-md lg:sticky lg:top-space-xl lg:col-span-4">
              {visibleState === 'completed' ? (
                <CompletedPanel
                  quiz={currentQuiz}
                  registered={signedIn && state === 'registered'}
                  isHost={isHost}
                />
              ) : (
                <RegistrationPanel
                  quiz={currentQuiz}
                  state={visibleState}
                  onRegister={() => void register()}
                  onUnregister={() => setUnregisterOpen(true)}
                  registering={pending === 'register'}
                />
              )}
              {error && (
                <Text
                  role="alert"
                  variant="body-secondary"
                  className="text-danger"
                >
                  {error}
                </Text>
              )}
            </aside>
          </div>
        </div>
      </main>
      <WorkspaceFooter />
      <Modal
        open={unregisterOpen}
        onOpenChange={setUnregisterOpen}
        title="Unregister from this quiz?"
        description="Your registration slot will be released. You can register again later if seats remain before registration closes."
      >
        <div className="space-y-space-md">
          <Surface className="space-y-space-xs bg-surface-low shadow-none">
            <Text variant="caption" tone="secondary">
              TARGET SESSION
            </Text>
            <Text variant="label">{quiz.title}</Text>
            <Text variant="caption" tone="secondary">
              {quiz.date} · {quiz.time}
            </Text>
          </Surface>
          <div className="flex flex-col-reverse gap-space-xs sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setUnregisterOpen(false)}>
              Keep registration
            </Button>
            <Button
              variant="danger"
              icon={<UserMinus size={18} aria-hidden="true" />}
              onClick={() => void unregister()}
              disabled={pending === 'unregister'}
              aria-busy={pending === 'unregister'}
            >
              {pending === 'unregister' ? 'Unregistering…' : 'Unregister'}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={hostNoticeOpen}
        onOpenChange={setHostNoticeOpen}
        title="Participant registration preview"
        description="You’re viewing the public quiz page as its host, so you can preview the participant experience but cannot reserve a seat yourself."
      >
        <div className="space-y-space-md">
          <Surface className="flex items-start gap-space-sm bg-surface-low shadow-none">
            <Info
              className="shrink-0 text-accent"
              size={20}
              aria-hidden="true"
            />
            <div>
              <Text variant="label">This is a public-view preview</Text>
              <Text variant="body-secondary" tone="secondary">
                When an eligible participant selects Register for quiz, their
                seat will be reserved and they’ll appear in your registration
                list.
              </Text>
            </div>
          </Surface>
          <div className="flex justify-end">
            <Button onClick={() => setHostNoticeOpen(false)}>Got it</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
