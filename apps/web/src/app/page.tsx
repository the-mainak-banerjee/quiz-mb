import { publicPageMetadata, SITE_DESCRIPTION, SITE_TITLE } from '@/config/seo';
import { LandingFinal } from '@/features/landing/final/landing-final';
import { currentUser } from '@/lib/auth/session';

export const metadata = publicPageMetadata({
  path: '/',
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
});

export default async function HomePage() {
  // The homepage stays public, including when an access token has expired.
  const user = await currentUser(false);
  return <LandingFinal user={user} />;
}
