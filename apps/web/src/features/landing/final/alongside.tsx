import type { CSSProperties } from 'react';
import { Text } from '@/components/ui';
import { MEETING_TOOLS } from '../meeting-tools';
import {
  FrameCorner,
  FrameHoverBackground,
  FadingFrameSides,
} from './frame-decorations';

/**
 * Where QuizMB fits: next to the host's usual call. A single-row logo cloud
 * (label on the left on desktop, above the row on phones); the logos blur
 * and slide in as the band scrolls into view. The note makes clear nothing
 * is installed or connected.
 */
export function AlongsideLogos() {
  return (
    <section
      aria-labelledby="alongside-title"
      className="mx-auto -mb-space-lg w-full max-w-content px-margin-sm md:mb-0 md:px-margin lg:px-space-xl"
    >
      <div className="group relative isolate grid grid-cols-1 justify-items-center gap-space-sm border-y border-dotted border-border-surface bg-surface px-space-md py-space-md text-center md:grid-cols-[minmax(0,1fr)_auto] md:justify-items-stretch md:gap-x-space-xl md:gap-y-space-xs md:px-space-lg md:py-space-lg md:text-left">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-full h-space-2xl"
        >
          <FadingFrameSides direction="up" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-full h-space-2xl"
        >
          <FadingFrameSides direction="down" />
        </div>
        <FrameHoverBackground />
        <FrameCorner className="-left-[7px] -top-[7px]" />
        <FrameCorner className="-right-[7px] -top-[7px]" />
        <FrameCorner className="-bottom-[7px] -left-[7px]" />
        <FrameCorner className="-bottom-[7px] -right-[7px]" />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-px bg-border-surface"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-px bg-border-surface"
        />
        <Text
          as="h2"
          id="alongside-title"
          variant="card-title"
          className="row-start-1 max-w-sm text-balance md:col-start-1 md:row-start-1"
        >
          Runs alongside your session on
        </Text>
        <ul className="row-start-2 flex flex-wrap items-center justify-center gap-x-space-xl gap-y-space-md md:col-start-2 md:row-span-2 md:row-start-1 md:justify-end">
          {MEETING_TOOLS.map((tool, index) => (
            <li
              key={tool.name}
              className="lp-logo flex items-center gap-space-xs text-text-secondary transition-colors hover:text-text-primary"
              style={{ '--lp-logo-start': `${index * 15}%` } as CSSProperties}
            >
              {tool.name === 'Zoom' ? (
                // The Zoom mark is its wordmark: shown on its own, larger.
                <svg
                  role="img"
                  aria-label="Zoom"
                  viewBox="0 7 24 10"
                  className="h-6 w-auto fill-current"
                >
                  <path d={tool.path} />
                </svg>
              ) : (
                <>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-6 fill-current"
                  >
                    <path d={tool.path} />
                  </svg>
                  <span className="text-card-title">{tool.name}</span>
                </>
              )}
            </li>
          ))}
        </ul>
        <Text
          variant="body-secondary"
          tone="secondary"
          className="row-start-3 max-w-sm text-pretty md:col-start-1 md:row-start-2"
        >
          Nothing to install or connect. Just share the quiz link in your
          call’s chat.
        </Text>
      </div>
    </section>
  );
}
