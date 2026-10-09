import { ArrowRight } from 'lucide-react';
import { Text } from '@/components/ui';
import { MiloStage } from '@/components/milo/milo-states';
import { cn } from '@/lib/utils';
import { CtaLink, LANDING_CONTAINER } from '../sections';
import { landingAction } from '../content';

/** The closing call to action on the dark brand surface, Milo cheering. */
export function FinalCta({ signedIn = false }: { signedIn?: boolean }) {
  const action = landingAction(signedIn);
  return (
    <section
      aria-labelledby="final-cta-title"
      className={cn(LANDING_CONTAINER, 'pb-space-2xl')}
    >
      <div className="relative isolate overflow-hidden rounded-feature bg-action-primary px-space-lg py-space-2xl text-center md:px-space-2xl">
        <div
          aria-hidden="true"
          className="lp-grid-inverse absolute inset-0 -z-10"
        />
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-space-md">
          <MiloStage pose="celebrate" className="w-32" />
          <Text
            as="h2"
            id="final-cta-title"
            variant="display"
            className="text-balance text-action-on-primary"
          >
            Ready to try it with your cohort?
          </Text>
          <Text className="text-pretty text-text-inverse/80">
            Create a quiz in minutes, share the link before class, and host it
            live, free during early access.
          </Text>
          <CtaLink href={action.href} variant="inverse">
            {action.label}
            <ArrowRight size={18} aria-hidden="true" />
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
