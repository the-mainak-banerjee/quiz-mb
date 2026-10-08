import Link from 'next/link';
import type { ReactNode } from 'react';
import { Badge, Text } from '@/components/ui';
import { Brand } from '@/components/brand';
import { MiloStage } from '@/components/milo/milo-states';
import type { MiloPose } from '@/components/milo/milo';
import { APP_LINKS } from '@/config/navigation';

export type AuthPanelPoint = { icon: ReactNode; title: string; detail: string };

/**
 * Split card shared by the verification and password-recovery screens: the
 * step on the left, a short explanation of what happens on the right, with
 * Milo at the foot of the panel (as on the sign-in and sign-up pages).
 */
export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  panel,
  milo = 'welcome',
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  panel: { eyebrow: string; title: string; points: AuthPanelPoint[] };
  /** Milo's pose in the panel. */
  milo?: MiloPose;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-margin-sm py-space-xl md:px-margin">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-feature border border-border-surface bg-surface shadow-floating lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-space-lg p-space-lg md:p-space-xl">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <Link
              href={APP_LINKS.HOME}
              prefetch={false}
              className="ds-focus inline-flex items-center"
            >
              <Brand />
            </Link>
            <Badge variant="scheduled" label={eyebrow} />
          </div>
          <div className="space-y-space-xs">
            <Text as="h1" variant="page-title">
              {title}
            </Text>
            <Text tone="secondary">{description}</Text>
          </div>
          {children}
          {footer && (
            <div className="mt-auto border-t border-border-surface pt-space-md">
              {footer}
            </div>
          )}
        </section>
        <aside
          aria-label={panel.eyebrow}
          className="flex flex-col gap-space-lg bg-action-primary p-space-lg md:p-space-xl"
        >
          <Text
            as="span"
            variant="caption"
            tone="inverse"
            className="w-fit rounded-pill bg-surface/10 px-badge-x py-badge-y"
          >
            {panel.eyebrow}
          </Text>
          <Text as="h2" variant="section-heading" tone="inverse">
            {panel.title}
          </Text>
          <ul className="flex flex-col gap-space-sm">
            {panel.points.map((point) => (
              <li
                key={point.title}
                className="flex items-start gap-space-sm rounded-control bg-surface/10 p-space-sm"
              >
                <span aria-hidden="true" className="mt-0.5 text-text-inverse">
                  {point.icon}
                </span>
                <span>
                  <Text variant="label" tone="inverse">
                    {point.title}
                  </Text>
                  <Text variant="caption" tone="inverse">
                    {point.detail}
                  </Text>
                </span>
              </li>
            ))}
          </ul>
          <MiloStage pose={milo} className="mt-auto w-24 self-end md:w-28" />
        </aside>
      </div>
    </main>
  );
}
