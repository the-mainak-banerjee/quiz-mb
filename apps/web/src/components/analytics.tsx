'use client';

import { Analytics, type BeforeSend } from '@vercel/analytics/next';

// Count visits by page, not by query string (returnTo, editor steps and
// the like), so each page's visits are counted together.
const withoutQuery: BeforeSend = (event) => {
  const url = new URL(event.url);
  url.search = '';
  return { ...event, url: url.toString() };
};

/**
 * Vercel Web Analytics: page views and visitors, cookieless. It only sends
 * data on a Vercel deployment with Analytics enabled for the project;
 * locally it logs to the console instead.
 */
export function SiteAnalytics() {
  return <Analytics beforeSend={withoutQuery} />;
}
