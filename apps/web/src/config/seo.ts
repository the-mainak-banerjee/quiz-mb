import type { Metadata } from 'next';

const configuredOrigin = process.env.SITE_URL ?? 'https://quizmb.com';
const siteUrl = new URL(configuredOrigin);
if (
  siteUrl.protocol !== 'https:' ||
  siteUrl.username ||
  siteUrl.password ||
  siteUrl.pathname !== '/' ||
  siteUrl.search ||
  siteUrl.hash
) {
  throw new Error(
    'SITE_URL must be the HTTPS production origin without a path, query, or credentials.',
  );
}

export const SITE_URL = siteUrl.origin;
export const SITE_TITLE = 'QuizMB | Live Quizzes for Classes and Communities';
export const SITE_DESCRIPTION =
  'Create and host live quizzes for your classes and communities. Share a link or QR code, control each question, and track results with QuizMB.';

/** Fail closed: a production build alone does not mean a live deployment. */
export function isLiveDeployment() {
  if (process.env.NODE_ENV !== 'production') return false;
  const vercelEnvironment = process.env.VERCEL_ENV;
  const deploymentEnvironment = process.env.DEPLOYMENT_ENV;
  if (vercelEnvironment && vercelEnvironment !== 'production') return false;
  if (deploymentEnvironment && deploymentEnvironment !== 'production')
    return false;
  return (
    vercelEnvironment === 'production' || deploymentEnvironment === 'production'
  );
}

export const NO_INDEX: Metadata['robots'] = { index: false, follow: true };

export const INDEXABLE_PATHS = [
  '/',
  '/documentation',
  '/help',
  '/privacy',
  '/terms',
  '/fair-use',
] as const;

// Canonicals are deliberately page-specific, never inherited from the root.
export function publicPageMetadata({
  path,
  title,
  description,
}: {
  path: (typeof INDEXABLE_PATHS)[number];
  title: Metadata['title'];
  description: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: new URL(path, SITE_URL).href },
    robots: { index: isLiveDeployment(), follow: true },
  };
}
