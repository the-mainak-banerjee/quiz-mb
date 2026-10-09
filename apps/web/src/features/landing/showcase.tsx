import { LandingScreenshot } from './screenshot';

/*
 * Real product screenshots captured from the live screens, with responsive
 * WebP assets in public/landing/optimized. Shown in the BrowserFrame from
 * ./mocks and the IPhone from ./iphone.
 */

/** The host console mid-question, as hosts see it on a laptop. */
export function HostConsoleShot({ priority = false }: { priority?: boolean }) {
  return (
    <LandingScreenshot
      name="host-console"
      alt="The QuizMB host console during a live question: the live answer breakdown with the correct answer highlighted, participation at 77%, the question list and the controls to end the quiz or show the leaderboard."
      sizes="(min-width: 1280px) 896px, (min-width: 1088px) 1024px, (min-width: 768px) calc(100vw - 64px), calc(100vw - 32px)"
      priority={priority}
    />
  );
}

/** A participant answering a question on their phone. */
export function ParticipantShot({ hero = false }: { hero?: boolean }) {
  return (
    <LandingScreenshot
      name="participant-answer"
      alt="A participant answering on a phone: the question, a countdown and four lettered options with one selected."
      sizes={hero ? '206px' : '(min-width: 768px) 238px, 222px'}
      {...(hero ? { minWidth: '80rem' as const } : {})}
    />
  );
}
