import { WorkspaceFooter } from '@/components/workspace/workspace-footer';
import type { CurrentUser } from '@/lib/auth/session';
import { LandingNav } from '../sections';
import { AlongsideLogos } from './alongside';
import { WhoItsFor } from './audiences';
import { FeatureBento } from './bento';
import { FinalCta } from './cta';
import { FinalFaq } from './faq';
import { FinalHero } from './hero';
import { ForLearners } from './learners';
import { HowItWorksSteps } from './steps';
import { GoToTop } from '../go-to-top';

/** The landing page, top to bottom. */
export function LandingFinal({ user = null }: { user?: CurrentUser | null }) {
  return (
    <div className="landing-page flex min-h-screen flex-col bg-canvas">
      <LandingNav user={user} />
      <main className="flex flex-1 flex-col gap-section-sm pb-section-sm md:gap-section md:pb-section lg:gap-section-lg lg:pb-section-lg">
        <FinalHero signedIn={Boolean(user)} />
        <AlongsideLogos />
        <HowItWorksSteps />
        <ForLearners />
        <FeatureBento />
        <WhoItsFor />
        <FinalFaq />
        <FinalCta signedIn={Boolean(user)} />
      </main>
      <WorkspaceFooter />
      <GoToTop />
    </div>
  );
}
