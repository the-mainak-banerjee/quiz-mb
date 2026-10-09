import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/config/seo';

// Crawling stays open: private pages are kept out of search by `noindex`
// (which crawlers must be able to read) and protected by authentication.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: new URL('/sitemap.xml', SITE_URL).href,
  };
}
