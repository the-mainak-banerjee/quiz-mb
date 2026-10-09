import type { MetadataRoute } from 'next';
import { INDEXABLE_PATHS, SITE_URL } from '@/config/seo';

// Only the canonical, indexable public pages. No lastModified: these pages
// have no reliable content-change date, and a guessed one misleads crawlers.
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_PATHS.map((path) => ({ url: new URL(path, SITE_URL).href }));
}
