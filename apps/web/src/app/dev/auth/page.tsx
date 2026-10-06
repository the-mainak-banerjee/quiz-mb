import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { AUTH_PREVIEW_SCREENS } from '@/features/auth/preview-list';

// Index of the development-only auth screen previews.
export default function AuthPreviewIndexPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <main className="mx-auto w-full max-w-content space-y-space-lg px-margin-sm py-space-xl md:px-margin lg:px-margin-lg">
      <div className="space-y-space-xs">
        <Text as="h1" variant="page-title">
          Auth screen previews
        </Text>
        <Text tone="secondary">
          Verification and recovery screens with fixture data. The API is only
          called when a form is submitted.
        </Text>
      </div>
      <ul className="grid grid-cols-1 gap-gutter-sm md:grid-cols-2">
        {AUTH_PREVIEW_SCREENS.map(({ slug, title }) => (
          <li key={slug}>
            <Surface className="p-0">
              <Link
                href={`/dev/auth/${slug}`}
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
