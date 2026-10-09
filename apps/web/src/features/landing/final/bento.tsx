import Image from 'next/image';
import type { ReactNode } from 'react';
import { ArrowRight, Clock3, FolderOpen, Link2, X } from 'lucide-react';
import { Brand } from '@/components/brand';
import { Avatar, Badge, Surface, Text } from '@/components/ui';
import { cn } from '@/lib/utils';
import { LandingCard } from '../card';
import { InView } from '../in-view';
import { AnswerBreakdownMock } from '../mocks';
import { LandingQrCode } from '../invitation';
import { SHARE_LINK } from '../content';
import { Eyebrow } from '../sections';

/**
 * A feature card. `visual-top`: the visual, then the text. `text-top`: the
 * text, then a real screenshot rising from the bottom of the card.
 */
function BentoCard({
  title,
  description,
  layout,
  children,
  className,
}: {
  title: string;
  description: string;
  layout: 'visual-top' | 'text-top';
  children: ReactNode;
  className?: string;
}) {
  const text = (
    <div className="space-y-space-xs p-space-lg">
      <Text as="h3" variant="section-heading">
        {title}
      </Text>
      <Text tone="secondary" className="max-w-md text-pretty">
        {description}
      </Text>
    </div>
  );
  return (
    <LandingCard className={cn('flex flex-col', className)}>
      {layout === 'visual-top' ? (
        <>
          {children}
          {text}
        </>
      ) : (
        <>
          {text}
          {children}
        </>
      )}
    </LandingCard>
  );
}

/**
 * A device-like frame for a screenshot: an outer shell with even padding and
 * an inner screen whose radius is the outer radius minus that padding
 * (feature 1.5rem - 0.5rem = card 1rem), so the corners stay concentric.
 * `bleed` runs off the right edge from md up; on phones it stays whole.
 */
function ShotFrame({
  bleed = false,
  className,
  children,
}: {
  bleed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-t-feature border-x border-t border-border-surface bg-surface-low/80 p-2 pb-0 shadow-raised backdrop-blur-sm',
        bleed && 'md:rounded-tr-none md:border-r-0 md:pr-0',
        className,
      )}
    >
      <div
        className={cn(
          'overflow-hidden rounded-t-card border-x border-t border-border-surface bg-surface',
          bleed && 'md:rounded-tr-none md:border-r-0',
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Lifts a framed visual a little when its card is hovered. */
const HOVER_LIFT =
  'transition-transform duration-500 ease-out group-hover:-translate-y-1.5 motion-reduce:transition-none';

/**
 * A real screenshot rising from the bottom of the card, in a ShotFrame.
 * `inset` sits between the card's side margins; `bleed` runs off the right
 * edge on wider screens.
 */
function CornerShot({
  src,
  alt,
  width,
  height,
  fit,
  displayWidth,
  areaHeight = 'h-64 md:h-72',
  phone,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  fit: 'bleed' | 'inset';
  /** A narrower capture shown below md instead, so nothing is cut off. */
  phone?: { src: string; width: number; height: number };
  /** Width from md up for `bleed`; wider than the card runs it off the side. */
  displayWidth?: string;
  areaHeight?: string;
}) {
  return (
    <div className={cn('relative mt-auto overflow-hidden', areaHeight)}>
      <ShotFrame
        bleed={fit === 'bleed'}
        className={cn(
          'absolute inset-x-space-lg top-0',
          HOVER_LIFT,
          fit === 'bleed' && cn('md:right-auto', displayWidth),
        )}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes="(min-width: 768px) 32rem, 90vw"
          className={cn('h-auto w-full', phone && 'max-md:hidden')}
        />
        {phone && (
          <Image
            src={phone.src}
            alt={alt}
            width={phone.width}
            height={phone.height}
            sizes="90vw"
            className="h-auto w-full md:hidden"
          />
        )}
      </ShotFrame>
    </div>
  );
}

const PROJECTS = [
  {
    name: 'Cohort 3 · Product Design',
    description: 'Weekly recaps for the autumn cohort.',
    quizzes: 8,
    updated: 'Oct 8, 2026',
  },
  {
    name: 'Friday community challenge',
    description: 'One topic quiz every Friday.',
    quizzes: 21,
    updated: 'Oct 3, 2026',
  },
];

/**
 * Project cards exactly as the Projects page draws them: stacked and whole
 * on phones, a row running off the right edge from md up.
 */
function ProjectCards() {
  return (
    <div className="relative mt-auto h-80 overflow-hidden md:h-72">
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-x-space-lg top-0 flex flex-col gap-gutter md:right-auto md:w-208 md:flex-row',
          HOVER_LIFT,
        )}
      >
        {PROJECTS.map((project) => (
          <Surface
            key={project.name}
            as="article"
            className="flex shrink-0 flex-col gap-space-md shadow-raised md:w-96"
          >
            <div className="flex items-start justify-between gap-space-sm">
              <div className="flex size-control shrink-0 items-center justify-center rounded-control bg-action-secondary text-accent">
                <FolderOpen size={20} aria-hidden="true" />
              </div>
              <Text
                as="span"
                variant="caption"
                tone="secondary"
                className="rounded-pill bg-surface-muted px-badge-x py-badge-y"
              >
                {project.quizzes} quizzes
              </Text>
            </div>
            <div className="flex-1 space-y-space-xs">
              <Text variant="section-heading">{project.name}</Text>
              <Text variant="body-secondary" tone="secondary">
                {project.description}
              </Text>
            </div>
            <div className="flex items-center justify-between gap-space-sm border-t border-border-surface pt-space-sm">
              <Text
                as="span"
                variant="caption"
                tone="secondary"
                className="inline-flex items-center gap-space-xs"
              >
                <Clock3 size={15} aria-hidden="true" />
                Updated {project.updated}
              </Text>
              <span className="inline-flex items-center gap-space-xs px-space-xs text-label text-accent">
                Open project
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}

/**
 * Joining: the share link and QR code, and the real lobby a learner lands
 * in once registered (rising from the bottom, framed).
 */
function JoinVisual() {
  const registered = ['Sophia Lin', 'Leo Martins', 'Priya Rao', 'Sam Okafor'];
  return (
    <div className="relative mt-auto h-72 overflow-hidden md:h-96">
      <div
        aria-hidden="true"
        className="absolute left-space-lg top-0 w-60 space-y-space-sm"
      >
        <div className="w-fit rounded-card border border-border-surface bg-surface p-space-sm shadow-raised">
          <LandingQrCode />
        </div>
        <span className="flex items-center gap-1.5 rounded-control border border-border-surface bg-surface-low px-2.5 py-2 text-caption">
          <Link2
            size={13}
            className="shrink-0 text-accent"
            aria-hidden="true"
          />
          <span className="truncate">{SHARE_LINK}</span>
        </span>
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
      <ShotFrame
        className={cn(
          'absolute left-[46%] top-0 w-70 max-md:hidden',
          HOVER_LIFT,
        )}
      >
        <Image
          src="/landing/bento-lobby.png"
          alt="A learner in the lobby after joining: Milo reading, Connected to live room, You're in the lobby, waiting for the host to start the quiz, with the quiz title and host."
          width={780}
          height={1568}
          sizes="17rem"
          className="h-auto w-full"
        />
      </ShotFrame>
    </div>
  );
}

/**
 * The feature bento: every visual is the real product (live components or
 * screenshots of it), in alternating wide and narrow cards.
 */
export function FeatureBento() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="mx-auto w-full max-w-content scroll-mt-20 px-margin-sm md:px-margin lg:px-space-xl"
    >
      <div className="mx-auto mb-space-xl max-w-2xl space-y-space-xs text-center">
        <Eyebrow>Built for teaching live</Eyebrow>
        <Text
          as="h2"
          id="features-title"
          variant="display"
          className="text-balance"
        >
          Ask, see the split, explain, move on.
        </Text>
        <Text tone="secondary" className="text-pretty">
          Every part of QuizMB is shaped around the moment between questions,
          when you find out what landed and teach the part that didn’t.
        </Text>
      </div>
      <div className="grid gap-gutter md:grid-cols-3">
        <BentoCard
          layout="visual-top"
          title="See what landed, while you’re still live"
          description="Answers arrive as a live breakdown only you can see, so you know exactly which idea to explain next."
          className="md:col-span-2"
        >
          {/* Framed as a live screen, so the mock question reads as product. */}
          <InView className="px-space-lg pt-space-lg">
            <div className="overflow-hidden rounded-card border border-border-surface bg-surface shadow-raised">
              {/* The live session header, as every live screen draws it. */}
              <div
                aria-hidden="true"
                className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-space-xs border-b border-border-surface bg-canvas px-space-md"
              >
                <span className="justify-self-start [&_svg]:h-space-md">
                  <Brand />
                </span>
                <Badge
                  variant="live"
                  label="Live session"
                  className="uppercase"
                />
                <span className="inline-flex items-center gap-1 justify-self-end text-caption text-danger">
                  <X size={16} />
                  Exit
                </span>
              </div>
              <div className="p-space-md">
                <AnswerBreakdownMock />
              </div>
            </div>
          </InView>
        </BentoCard>
        <BentoCard
          layout="text-top"
          title="You reveal the leaderboard"
          description="Show it after a tough question, or save it for the finale."
        >
          <CornerShot
            src="/landing/bento-leaderboard.png"
            alt="The leaderboard as the host sees it: the top players with ranks, names and total points, and a button to hide it from participants."
            width={1052}
            height={1680}
            fit="inset"
            areaHeight="min-h-64 flex-1 md:min-h-72"
          />
        </BentoCard>
        <BentoCard
          layout="text-top"
          title="Faster correct answers score more"
          description="When the timer ends, each learner sees the right answer and the points they earned."
        >
          <CornerShot
            src="/landing/bento-result.png"
            alt="A participant's result on a phone: Correct, plus 820 points, with the share of answers for each option."
            width={712}
            height={1200}
            fit="inset"
            areaHeight="h-72 md:h-96"
          />
        </BentoCard>
        <BentoCard
          layout="text-top"
          title="Join from any phone"
          description="Share a link or QR code before class. Learners register once and are ready when you start."
          className="md:col-span-2"
        >
          <JoinVisual />
        </BentoCard>
        <BentoCard
          layout="text-top"
          title="A project for every cohort"
          description="Keep each course, cohort or community’s quizzes together, week after week."
          className="md:col-span-2"
        >
          <ProjectCards />
        </BentoCard>
        <BentoCard
          layout="text-top"
          title="Everyone keeps their history"
          description="Learners keep their final score and rank for every quiz they join."
        >
          <CornerShot
            src="/landing/bento-history.png"
            alt="A participant's history: completed quizzes with the final score, correct and incorrect answers, and final rank."
            width={1840}
            height={1080}
            fit="bleed"
            displayWidth="md:w-[34rem]"
            phone={{
              src: '/landing/bento-history-phone.png',
              width: 780,
              height: 1120,
            }}
          />
        </BentoCard>
      </div>
    </section>
  );
}
