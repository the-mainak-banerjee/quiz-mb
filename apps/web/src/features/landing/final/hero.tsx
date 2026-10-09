import {
  ArrowDown,
  ArrowRight,
  CreditCardX,
  QrCode,
  Sparkles,
  VideoOff,
} from 'lucide-react';
import { Text } from '@/components/ui';
import { Milo } from '@/components/milo/milo';
import { CtaLink } from '../sections';
import { HOST_LINK, landingAction } from '../content';
import { IPhone } from '../iphone';
import { BrowserFrame } from '../mocks';
import { HostConsoleShot, ParticipantShot } from '../showcase';

/** Friction removers under the calls to action. */
const REASSURANCES = [
  {
    icon: QrCode,
    before: 'Learners join by ',
    strong: 'link or QR code',
    after: '',
  },
  { icon: VideoOff, before: '', strong: 'No video tool', after: ' to switch' },
  { icon: CreditCardX, before: '', strong: 'No credit card', after: ' needed' },
] as const;

/**
 * The final landing hero: Version A's centred layout with the real product
 * (the host console in a browser window, a participant on a phone) and Milo
 * welcoming from the top of the window. Reassurances sit above the calls to
 * action.
 */
export function FinalHero({ signedIn = false }: { signedIn?: boolean }) {
  const action = landingAction(signedIn);
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden"
    >
      <div aria-hidden="true" className="lp-grid absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-24 -z-10 h-96 w-[48rem] max-w-full -translate-x-1/2 rounded-pill bg-status-live-surface blur-3xl"
      />
      <div className="mx-auto flex w-full max-w-content flex-col items-center px-margin-sm pt-space-2xl text-center md:px-margin lg:pt-section lg:px-space-xl">
        {/* The icon sits inline with the first words, so it stays with them
            when the line wraps on phones. */}
        <Text
          as="span"
          variant="label"
          className="inline-block rounded-card border border-border-surface bg-surface px-space-sm py-1.5 text-text-secondary shadow-card sm:rounded-pill"
        >
          <Sparkles
            size={14}
            className="mr-1.5 inline-block align-[-2px] text-accent"
            aria-hidden="true"
          />
          Live quizzes for cohorts · Free during early access
        </Text>
        <h1
          id="hero-title"
          className="mt-space-md max-w-4xl text-balance text-hero-mobile md:text-hero"
        >
          Turn your next live session into a quiz challenge.
        </h1>
        <Text
          tone="secondary"
          className="mt-space-md max-w-2xl text-pretty text-section-heading font-normal"
        >
          Get your learners answering, competing and discussing with live
          quizzes, timed questions and leaderboards, all guided by you.
        </Text>
        <ul className="mt-space-md flex flex-wrap justify-center gap-x-space-md gap-y-space-xs">
          {REASSURANCES.map(({ icon: Icon, before, strong, after }) => (
            <li key={strong} className="flex items-center gap-1.5">
              <span className="flex size-6 items-center justify-center rounded-pill bg-action-secondary text-accent">
                <Icon size={14} aria-hidden="true" />
              </span>
              <Text as="span" variant="body-secondary" tone="secondary">
                {before}
                <span className="font-semibold text-text-primary">
                  {strong}
                </span>
                {after}
              </Text>
            </li>
          ))}
        </ul>

        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <CtaLink href={action.href}>
            {action.label}
            <ArrowRight size={18} aria-hidden="true" />
          </CtaLink>
          <CtaLink href="#how-it-works" variant="outline">
            See how a session works
            <ArrowDown size={18} aria-hidden="true" />
          </CtaLink>
        </div>
        <div className="relative mt-space-2xl w-full max-w-5xl md:mt-space-xl xl:max-w-4xl">
          {/* Milo stands on the window, out of the way of the buttons. */}
          <Milo
            pose="welcome"
            className="absolute bottom-full left-space-sm z-10 w-16 translate-y-[12%] md:w-24 xl:left-space-lg xl:w-28"
          />
          <BrowserFrame url={HOST_LINK} decorative={false}>
            <HostConsoleShot priority />
          </BrowserFrame>
          {/* The participant's phone flanks the window on wide screens. */}
          <div className="lp-float absolute -right-36 top-16 hidden xl:block">
            <IPhone onLight className="w-56">
              <ParticipantShot hero />
            </IPhone>
          </div>
        </div>
      </div>
    </section>
  );
}
