'use client';
import { useState } from 'react';
import { ArrowUpRight, House, Pause, Play, RotateCcw } from 'lucide-react';
import { Button, GlobalLoader, Surface, Text } from '@/components/ui';
import { Milo, type MiloPose } from '@/components/milo/milo';
import {
  MiloLoading,
  MiloMessage,
  MiloStage,
  PageLoader,
} from '@/components/milo/milo-states';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { cn } from '@/lib/utils';

const POSES: { pose: MiloPose; use: string; motion: string }[] = [
  {
    pose: 'welcome',
    use: 'Login and signup',
    motion: 'Waves, blinks and bobs',
  },
  {
    pose: 'loading',
    use: 'Loading overlay and page loading',
    motion: 'Sways while thinking dots appear',
  },
  {
    pose: 'error',
    use: 'Error page and 404',
    motion: 'Shrugs, arms wobble',
  },
  {
    pose: 'celebrate',
    use: 'Quiz completed (host and participant)',
    motion: 'Jumps, cheers, confetti',
  },
];

const LIVE_SCREENS = [
  ['Login (welcome)', '/login'],
  ['Signup (welcome on dark)', '/signup'],
  ['404 page', '/dev/milo/missing-page'],
  ['Host quiz completed', '/dev/live/host-quiz-completed'],
  ['Participant quiz ended', '/dev/live/participant-quiz-ended'],
] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Surface as="section" aria-labelledby={id} className="space-y-space-md">
      <div className="space-y-space-xs">
        <Text as="h2" id={id} variant="section-heading">
          {title}
        </Text>
        <Text variant="body-secondary" tone="secondary">
          {description}
        </Text>
      </div>
      {children}
    </Surface>
  );
}

export function MiloGallery() {
  const [playing, setPlaying] = useState(true);
  const [overlay, setOverlay] = useState(false);

  function showOverlay() {
    setOverlay(true);
    window.setTimeout(() => setOverlay(false), 4000);
  }

  return (
    <div
      className={cn(
        'space-y-space-xl',
        // Pausing freezes every Milo animation for close inspection.
        !playing && '[&_*]:[animation-play-state:paused]',
      )}
    >
      <div className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
        <div className="space-y-space-xs">
          <Text as="h1" variant="display">
            Milo, the QuizMB mascot
          </Text>
          <Text tone="secondary" className="max-w-2xl">
            Every pose and every place Milo appears. Animations run only when
            the viewer allows motion; with reduced motion turned on, Milo is a
            still illustration.
          </Text>
        </div>
        <Button
          variant="secondary"
          icon={
            playing ? (
              <Pause size={18} aria-hidden="true" />
            ) : (
              <Play size={18} aria-hidden="true" />
            )
          }
          onClick={() => setPlaying((value) => !value)}
          aria-pressed={!playing}
        >
          {playing ? 'Pause animations' : 'Play animations'}
        </Button>
      </div>

      <Section
        id="poses"
        title="Poses"
        description="Each pose on the light canvas and on the dark brand surface (with the glow used on dark panels)."
      >
        <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
          {POSES.map(({ pose, use, motion }) => (
            <div key={pose} className="space-y-space-sm">
              <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border-surface">
                <div className="grid place-items-center bg-canvas p-space-md">
                  <Milo pose={pose} className="w-full max-w-36" />
                </div>
                <div className="grid place-items-center bg-action-primary p-space-md">
                  <MiloStage pose={pose} className="w-full max-w-36" />
                </div>
              </div>
              <div>
                <Text variant="card-title" className="capitalize">
                  {pose}
                </Text>
                <Text variant="caption" tone="secondary">
                  {use}
                </Text>
                <Text variant="caption" className="text-accent">
                  {motion}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="sizes"
        title="Sizes"
        description="Milo is a vector drawing, so he stays sharp from an inline accent to a hero illustration."
      >
        <div className="flex flex-wrap items-end gap-space-lg">
          {(
            [
              ['w-12', '48px'],
              ['w-20', '80px'],
              ['w-28', '112px'],
              ['w-44', '176px'],
              ['w-64', '256px'],
            ] as const
          ).map(([width, label]) => (
            <div
              key={label}
              className="flex flex-col items-center gap-space-xs"
            >
              <Milo pose="welcome" className={width} />
              <Text variant="caption" tone="secondary">
                {label}
              </Text>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="loading"
        title="Loading"
        description="The loading block used by the publishing overlay and every page-loading screen."
      >
        <div className="grid gap-gutter lg:grid-cols-2">
          <div className="space-y-space-xs">
            <Text variant="label">Loading block with a hint</Text>
            <div className="rounded-card border border-border-surface bg-canvas py-space-xl">
              <MiloLoading
                label="Publishing your quiz…"
                hint="Opening registration and preparing the public page."
              />
            </div>
          </div>
          <div className="space-y-space-xs">
            <Text variant="label">Page loading screen (loading.tsx)</Text>
            <div className="overflow-hidden rounded-card border border-border-surface bg-canvas [&>div]:min-h-0">
              <PageLoader label="Loading your workspace…" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button onClick={showOverlay} disabled={overlay}>
            Show the full-screen overlay
          </Button>
          <Text variant="caption" tone="secondary">
            Opens the real publishing overlay for 4 seconds.
          </Text>
        </div>
      </Section>

      <Section
        id="messages"
        title="Error and 404"
        description="The full-page messages, shown here in a frame. The real pages fill the screen."
      >
        <div className="grid gap-gutter lg:grid-cols-2">
          <div className="overflow-hidden rounded-card border border-border-surface">
            <MiloMessage
              className="h-full min-h-0 py-space-xl"
              pose="error"
              eyebrow="Something went wrong"
              title="Milo hit a snag"
              description="This page didn’t load properly. Try again, and if it keeps happening, come back in a moment."
            >
              <div className="flex flex-col gap-space-xs sm:flex-row">
                <Button icon={<RotateCcw size={18} aria-hidden="true" />}>
                  Try again
                </Button>
                <Button variant="secondary">Go home</Button>
              </div>
              <Text variant="caption" tone="secondary">
                Error ID: 2967767138
              </Text>
            </MiloMessage>
          </div>
          <div className="overflow-hidden rounded-card border border-border-surface">
            <MiloMessage
              className="h-full min-h-0 py-space-xl"
              pose="error"
              eyebrow="404 · Page not found"
              title="Milo looked everywhere"
              description="This page doesn’t exist, or the link may be out of date."
            >
              <Button icon={<House size={18} aria-hidden="true" />}>
                Return home
              </Button>
            </MiloMessage>
          </div>
        </div>
      </Section>

      <Section
        id="in-app"
        title="In the app"
        description="The real screens that use Milo."
      >
        <div className="flex flex-wrap gap-space-xs">
          {LIVE_SCREENS.map(([label, href]) => (
            <NavigationItem
              key={href}
              href={href}
              icon={<ArrowUpRight size={16} aria-hidden="true" />}
              iconPosition="right"
              className="bg-action-secondary text-accent hover:bg-action-secondary-hover"
            >
              {label}
            </NavigationItem>
          ))}
        </div>
      </Section>

      {overlay && (
        <GlobalLoader
          label="Publishing your quiz…"
          hint="Opening registration and preparing the public page."
        />
      )}
    </div>
  );
}
