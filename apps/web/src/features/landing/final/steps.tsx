import type { CSSProperties, ReactNode } from 'react';
import { Check, Copy, Link2, Plus, Radio, Timer, Trophy } from 'lucide-react';
import { Avatar, Text } from '@/components/ui';
import {
  OptionLetter,
  QuestionChip,
} from '@/features/live-session/question-parts';
import { cn } from '@/lib/utils';
import { LandingCard } from '../card';
import { SHARE_LINK, STEPS } from '../content';
import { InView } from '../in-view';
import { Eyebrow } from '../sections';
import { QrPattern } from '../mocks';

/** Appears in sequence once its card scrolls into view (landing.css). */
function Seq({
  at,
  children,
  className,
}: {
  /** Seconds after the card enters the view. */
  at: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('lp-seq', className)}
      style={{ '--lp-at': `${at}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Step 1: a question taking shape, its options arriving one by one. */
function BuildSkeleton() {
  const options = [
    'A new value each render',
    'A mutable ref object',
    'A cleanup function',
  ];
  return (
    <div aria-hidden="true" className="w-full min-w-0 max-w-xs space-y-2">
      <Seq at={0} className="flex items-center gap-1.5">
        <QuestionChip tone="strong">Question 1</QuestionChip>
        <QuestionChip>Single choice</QuestionChip>
        <span className="ml-auto inline-flex items-center gap-1 text-caption text-text-secondary">
          <Timer size={12} aria-hidden="true" />
          20s
        </span>
      </Seq>
      <Seq at={0.2}>
        <Text variant="card-title">What does useRef return?</Text>
      </Seq>
      {options.map((text, index) => {
        const correct = index === 1;
        return (
          <Seq key={text} at={0.45 + index * 0.25}>
            {/* The option row as the builder and live screens draw it. */}
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-control border px-2.5 py-2 text-caption',
                correct
                  ? 'border-accent bg-status-live-surface font-semibold text-status-live-text'
                  : 'border-border-surface bg-surface-low text-text-primary',
              )}
            >
              <OptionLetter index={index} emphasized={correct} />
              <span className="min-w-0 flex-1 truncate">{text}</span>
              {correct && (
                <span
                  className="lp-seq inline-flex shrink-0 items-center gap-0.5"
                  style={{ '--lp-at': '1.4s' } as CSSProperties}
                >
                  <Check size={12} aria-hidden="true" />
                  Correct
                </span>
              )}
            </div>
          </Seq>
        );
      })}
      <Seq at={1.6}>
        <span className="inline-flex items-center gap-1 text-caption font-semibold text-accent">
          <Plus size={12} aria-hidden="true" />
          Add question
        </span>
      </Seq>
    </div>
  );
}

/** Step 2: copying the share link (a pointer clicks Copy) and the QR code. */
function ShareSkeleton() {
  const registered = ['Sophia Lin', 'Leo Martins', 'Priya Rao', 'Sam Okafor'];
  return (
    <div
      aria-hidden="true"
      className="w-full min-w-0 max-w-xs space-y-space-sm"
    >
      <Text variant="card-title">Share with your cohort</Text>
      <div className="flex items-center gap-1.5">
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-control border border-border-surface bg-surface-low px-2.5 py-2 text-caption">
          <Link2
            size={13}
            className="shrink-0 text-accent"
            aria-hidden="true"
          />
          <span className="truncate">{SHARE_LINK}</span>
        </span>
        <span className="relative inline-flex h-9 w-[5.25rem] shrink-0 items-center justify-center rounded-control bg-action-secondary text-caption font-semibold text-accent">
          <span className="lp-copy-idle inline-flex items-center gap-1">
            <Copy size={13} aria-hidden="true" />
            Copy
          </span>
          <span className="lp-copy-done absolute inset-0 inline-flex items-center justify-center gap-1">
            <Check size={13} aria-hidden="true" />
            Copied
          </span>
          {/* One pointer glides in and clicks Copy. */}
          <svg
            viewBox="0 0 16 16"
            className="lp-pointer absolute left-[55%] top-[45%] size-5 fill-text-primary stroke-surface"
            strokeWidth="1.2"
          >
            <path d="M2 1l5.6 13.6L9.5 9.2l5.5-1.9z" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <div className="flex items-center gap-space-sm">
        <div className="shrink-0 rounded-control border border-border-surface bg-surface p-1.5">
          <QrPattern className="size-16" />
        </div>
        <div className="min-w-0 space-y-1.5">
          <Text variant="caption" tone="secondary">
            Or scan to register
          </Text>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1.5">
              {registered.map((name) => (
                <Avatar
                  key={name}
                  name={name}
                  size="small"
                  decorative
                  className="ring-2 ring-surface"
                />
              ))}
            </div>
            <Text variant="caption" className="font-semibold text-accent">
              18 registered
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Step 3: the live answer breakdown filling in, then the leaderboard. */
function HostSkeleton() {
  const bars = [
    { letter: 0, text: 'A new value', percent: 21 },
    { letter: 1, text: 'A mutable ref', percent: 67, correct: true },
    { letter: 2, text: 'A cleanup', percent: 12 },
  ];
  return (
    <div aria-hidden="true" className="w-full min-w-0 max-w-xs space-y-2">
      <div className="flex items-center justify-between gap-space-xs">
        <QuestionChip tone="live">
          <Radio size={12} aria-hidden="true" />
          Live
        </QuestionChip>
        <span className="text-caption font-semibold text-accent">
          22 of 24 answered
        </span>
      </div>
      {bars.map((bar, index) => (
        // The breakdown row as the host console draws it.
        <div
          key={bar.letter}
          className={cn(
            'relative isolate flex items-center gap-2.5 overflow-hidden rounded-control px-2.5 py-2 text-caption',
            bar.correct
              ? 'bg-status-live-surface shadow-card'
              : 'bg-surface-low',
          )}
        >
          <span
            className={cn(
              'lp-grow absolute inset-y-0 left-0 -z-10',
              bar.correct ? 'bg-action-secondary-hover' : 'bg-surface-high',
            )}
            style={
              {
                width: `${bar.percent}%`,
                '--lp-at': `${0.2 + index * 0.15}s`,
              } as CSSProperties
            }
          />
          <OptionLetter index={bar.letter} emphasized={bar.correct === true} />
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              bar.correct && 'font-semibold',
            )}
          >
            {bar.text}
          </span>
          <span className="font-bold tabular-nums">{bar.percent}%</span>
        </div>
      ))}
      <Seq at={1.3}>
        <div className="flex items-center gap-1.5 rounded-control bg-action-primary px-2.5 py-1.5 text-caption text-action-on-primary">
          <Trophy size={12} aria-hidden="true" />
          <span className="font-semibold">1</span>
          <Avatar name="Sophia Lin" size="small" decorative />
          <span className="min-w-0 flex-1 truncate">Sophia Lin</span>
          <span className="tabular-nums">2,840</span>
        </div>
      </Seq>
    </div>
  );
}

const SKELETONS = [BuildSkeleton, ShareSkeleton, HostSkeleton];

/**
 * How a session runs: three cards, each showing its step as a small piece
 * of the real product, drawn straight on the card and played when the card
 * scrolls into view.
 */
export function HowItWorksSteps() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="mx-auto w-full max-w-content scroll-mt-20 px-margin-sm md:px-margin lg:px-space-xl"
    >
      <div className="mx-auto mb-space-xl max-w-2xl space-y-space-xs text-center">
        <Eyebrow>How a session runs</Eyebrow>
        <Text
          as="h2"
          id="how-it-works-title"
          variant="display"
          className="text-balance"
        >
          Host your first live quiz in three steps.
        </Text>
      </div>
      <ol className="grid gap-gutter md:grid-cols-3">
        {STEPS.map((step, index) => {
          const Skeleton = SKELETONS[index]!;
          return (
            <li key={step.title} className="flex min-w-0">
              <LandingCard className="flex w-full min-w-0 flex-col">
                <InView className="flex h-72 items-center justify-center px-space-lg pt-space-lg">
                  <Skeleton />
                </InView>
                <div className="space-y-space-xs p-space-lg pt-space-md">
                  <Text
                    as="span"
                    variant="caption"
                    className="font-semibold text-accent"
                  >
                    Step {index + 1}
                  </Text>
                  <Text as="h3" variant="section-heading">
                    {step.title}
                  </Text>
                  <Text tone="secondary">{step.body}</Text>
                </div>
              </LandingCard>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
