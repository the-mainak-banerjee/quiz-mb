import { Check } from 'lucide-react';
import { Text } from '@/components/ui';
import { MiloStage } from '@/components/milo/milo-states';
import { AUDIENCES } from '../content';
import { Eyebrow } from '../sections';
import {
  FrameCorner as Corner,
  FrameHoverBackground,
  FadingFrameSides as FadingSides,
} from './frame-decorations';

/** Each audience's Milo, as in landing B. */
const POSES = ['search', 'greet'] as const;

/**
 * Who it's for: no cards (the page has plenty). Thin frame lines: the side
 * lines run past the frame and fade out above the heading and below the
 * audiences, a plus marks every place two lines meet, and a divider runs
 * between the two audiences, each with its own Milo. Each half warms with
 * the cards' glow on hover.
 */
export function WhoItsFor() {
  return (
    <section
      id="who-its-for"
      aria-labelledby="who-title"
      className="mx-auto w-full max-w-content scroll-mt-20 px-margin-sm md:px-margin lg:px-space-xl"
    >
      <div className="relative">
        <FadingSides direction="up" />
        <div className="mx-auto max-w-2xl space-y-space-xs px-space-lg pb-space-xl pt-space-lg text-center">
          <Eyebrow>Who it’s for</Eyebrow>
          <Text
            as="h2"
            id="who-title"
            variant="display"
            className="text-balance"
          >
            Bring your learners together. Make every session interactive.
          </Text>
          <Text tone="secondary" className="text-pretty">
            Built for course creators, coaches, and community hosts who want
            their learners to join in, not just listen.
          </Text>
        </div>
      </div>

      <div className="relative border border-border-surface">
        <Corner className="-left-[7px] -top-[7px]" />
        <Corner className="-right-[7px] -top-[7px]" />
        <Corner className="-bottom-[7px] -left-[7px]" />
        <Corner className="-bottom-[7px] -right-[7px]" />
        {/* Where the divider meets the top and bottom lines. */}
        <Corner className="-top-[7px] left-1/2 -translate-x-1/2 max-md:hidden" />
        <Corner className="-bottom-[7px] left-1/2 -translate-x-1/2 max-md:hidden" />

        <div className="grid divide-y divide-border-surface md:grid-cols-2 md:divide-x md:divide-y-0">
          {AUDIENCES.map((audience, index) => (
            <article
              key={audience.title}
              className="group relative isolate flex flex-col gap-space-md bg-surface px-space-lg py-space-xl md:px-space-2xl"
            >
              <FrameHoverBackground />
              {/* On phones, where the stacked audiences' divider meets the sides. */}
              {index > 0 && (
                <>
                  <Corner className="-left-[8px] -top-[8px] md:hidden" />
                  <Corner className="-right-[8px] -top-[8px] md:hidden" />
                </>
              )}
              <MiloStage
                pose={POSES[index]!}
                className="absolute right-space-sm top-space-md w-20 md:right-space-lg md:w-28"
              />
              <div className="space-y-space-xs pr-space-2xl md:pr-28">
                <Eyebrow>{audience.eyebrow}</Eyebrow>
                <Text
                  as="h3"
                  variant="section-heading"
                  className="text-balance"
                >
                  {audience.title}
                </Text>
              </div>
              <blockquote className="border-l-2 border-accent-soft pl-space-sm">
                <Text tone="secondary" className="text-pretty">
                  {audience.scenario}
                </Text>
              </blockquote>
              <ul className="space-y-space-xs">
                {audience.points.map((point) => (
                  <li key={point} className="flex items-center gap-space-xs">
                    <Check
                      size={16}
                      className="shrink-0 text-accent"
                      aria-hidden="true"
                    />
                    <Text as="span" variant="body-secondary">
                      {point}
                    </Text>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="relative h-space-2xl">
        <FadingSides direction="down" />
      </div>
    </section>
  );
}
