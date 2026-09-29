import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { LIVE_PREVIEW_SCREENS } from '@/features/live-session/preview-screens';

// Index of the development-only live screen previews.
export default function LivePreviewIndexPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <main className="mx-auto w-full max-w-content space-y-space-lg px-margin-sm py-space-xl md:px-margin lg:px-margin-lg">
      <div className="space-y-space-xs">
        <Text as="h1" variant="page-title">
          Live session previews
        </Text>
        <Text tone="secondary">
          Phase 5 screens rendered with fixture data. No API or realtime
          connection is used.
        </Text>
      </div>
      <ul className="grid grid-cols-1 gap-gutter-sm md:grid-cols-2">
        {LIVE_PREVIEW_SCREENS.map(({ slug, title }) => (
          <li key={slug}>
            <Surface className="p-0">
              <Link
                href={`/dev/live/${slug}`}
                className="ds-focus flex items-center justify-between gap-space-sm rounded-card p-space-md text-card-title hover:bg-surface-low"
              >
                {title}
                <ArrowRight
                  size={18}
                  aria-hidden="true"
                  className="text-accent"
                />
              </Link>
            </Surface>
          </li>
        ))}
      </ul>
    </main>
  );
}
