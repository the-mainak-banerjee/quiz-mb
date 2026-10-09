import Image from 'next/image';

/*
 * Real product screenshots (public/landing, captured from the live screens
 * by scripts/capture-landing-shots.mjs). Shown in the BrowserFrame from
 * ./mocks and the IPhone from ./iphone.
 */

/** The host console mid-question, as hosts see it on a laptop. */
export function HostConsoleShot({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      src="/landing/host-console.png"
      alt="The QuizMB host console during a live question: the live answer breakdown with the correct answer highlighted, participation at 77%, the question list and the controls to end the quiz or show the leaderboard."
      width={2880}
      height={1800}
      sizes="(min-width: 1280px) 1024px, 92vw"
      priority={priority}
      className="h-auto w-full"
    />
  );
}

/** A participant answering a question on their phone. */
export function ParticipantShot() {
  return (
    <Image
      src="/landing/participant-answer.png"
      alt="A participant answering on a phone: the question, a countdown and four lettered options with one selected."
      width={780}
      height={1688}
      sizes="240px"
      className="h-auto w-full"
    />
  );
}
