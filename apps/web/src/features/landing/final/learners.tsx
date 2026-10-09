import { QrCode, Timer, Trophy } from 'lucide-react';
import { Text } from '@/components/ui';
import { MiloStage } from '@/components/milo/milo-states';
import { IPhone } from '../iphone';
import { Eyebrow } from '../sections';
import { ParticipantShot } from '../showcase';

const POINTS = [
  { icon: QrCode, text: 'Join from a link or QR code' },
  { icon: Timer, text: 'Race the timer for speed points' },
  { icon: Trophy, text: 'See their result and rank after each question' },
] as const;

/**
 * For your learners: the participant's side, on the dark brand surface of
 * landing B with the cards' grid and glow, a real phone screen and Milo.
 */
export function ForLearners() {
  return (
    <section
      aria-labelledby="learners-title"
      className="mx-auto w-full max-w-content px-margin-sm md:px-margin lg:px-space-xl"
    >
      <div className="relative isolate overflow-hidden rounded-feature bg-action-primary">
        <div
          aria-hidden="true"
          className="lp-grid-inverse absolute inset-0 -z-10"
        />
        {/* The cards' soft glow, in the brand's lighter green. */}
        <div
          aria-hidden="true"
          className="absolute -top-32 left-1/2 -z-10 h-80 w-[70%] -translate-x-1/2 rounded-pill bg-accent opacity-45 blur-3xl"
        />
        {/* On phones Milo reads in the top-right corner instead. */}
        <MiloStage
          pose="waiting"
          className="absolute right-space-sm top-space-md w-20 sm:hidden"
        />
        <div className="grid items-center gap-space-xl px-space-lg py-space-2xl md:px-space-2xl lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-space-md">
            <Eyebrow inverse>For your learners</Eyebrow>
            <Text
              as="h2"
              id="learners-title"
              variant="display"
              className="text-balance text-action-on-primary max-sm:pr-space-xl"
            >
              A game on their phone, not another tool to learn.
            </Text>
            <Text className="max-w-lg text-pretty text-text-inverse/80">
              They tap an answer before the timer runs out. When it ends, they
              see the correct answer, their points and their new rank, while you
              explain.
            </Text>
            <ul className="space-y-space-sm pt-space-xs">
              {POINTS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-space-sm">
                  <span className="flex size-8 items-center justify-center rounded-pill bg-text-inverse/10 text-accent-soft">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <Text as="span" className="text-text-inverse/90">
                    {text}
                  </Text>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative flex justify-center">
            <IPhone className="w-60 md:w-64">
              <ParticipantShot />
            </IPhone>
            <MiloStage
              pose="waiting"
              className="absolute bottom-6 left-0 hidden w-32 sm:grid lg:-left-4"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
