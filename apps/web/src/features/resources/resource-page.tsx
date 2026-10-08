import type { ReactNode } from 'react';
import { CalendarDays, Mail, ShieldCheck } from 'lucide-react';
import { Callout, Surface, Text } from '@/components/ui';
import { Milo } from '@/components/milo/milo';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '@/config/support';
import { cn } from '@/lib/utils';
import { ContentsNavigation } from './contents-navigation';
import { ResourceLink } from './resource-link';

export type ResourceSection = {
  id: string;
  title: string;
  label?: string;
  content: ReactNode;
};

export function ResourcePage({
  title,
  description,
  label,
  updated,
  sections,
  introduction,
  children,
  appearance = 'policy',
  numberedSections = true,
}: {
  title: string;
  description: string;
  label: string;
  updated?: string;
  sections: ResourceSection[];
  introduction?: ReactNode;
  children?: ReactNode;
  appearance?: 'policy' | 'documentation' | 'terms';
  numberedSections?: boolean;
}) {
  return (
    <main className="min-w-0 flex-1">
      <header
        className={cn(
          'py-space-xl md:py-space-2xl',
          appearance !== 'documentation' && 'bg-surface-low',
        )}
      >
        <div className="mx-auto max-w-content space-y-space-sm px-margin-sm md:px-margin lg:px-space-xl">
          <Text variant="caption" tone="secondary" className="uppercase">
            {label}
          </Text>
          <Text as="h1" variant="display">
            {title}
          </Text>
          <Text tone="secondary" className="max-w-3xl">
            {description}
          </Text>
          {updated && (
            <Text
              variant="caption"
              tone="secondary"
              className="flex items-center gap-space-xs"
            >
              <CalendarDays size={16} aria-hidden="true" />
              Last updated: {updated}
            </Text>
          )}
        </div>
      </header>
      <div className="mx-auto grid max-w-content gap-space-xl px-margin-sm py-space-xl md:px-margin lg:grid-cols-12 lg:px-space-xl lg:py-space-2xl">
        <aside className="hidden min-w-0 space-y-space-md lg:block lg:sticky lg:top-space-2xl lg:col-span-3 lg:self-start">
          <ContentsNavigation
            items={sections.map(({ id, title }) => ({ id, title }))}
          />
          <Callout icon={<ShieldCheck size={20} aria-hidden="true" />}>
            Questions about QuizMB? Contact us using the email at the end of
            this page.
          </Callout>
        </aside>
        <div className="min-w-0 space-y-space-xl lg:col-span-9">
          {introduction}
          {sections.map(
            (
              { id, title: sectionTitle, label: sectionLabel, content },
              index,
            ) => {
              const body = (
                <>
                  <div className="space-y-space-xs">
                    {(numberedSections || sectionLabel) && (
                      <Text variant="caption" className="text-accent uppercase">
                        {numberedSections && String(index + 1).padStart(2, '0')}
                        {sectionLabel &&
                          `${numberedSections ? ' / ' : ''}${sectionLabel}`}
                      </Text>
                    )}
                    <Text
                      as="h2"
                      variant={
                        appearance === 'terms'
                          ? 'section-heading'
                          : 'page-title'
                      }
                    >
                      {sectionTitle}
                    </Text>
                  </div>
                  <div className="space-y-space-md">{content}</div>
                </>
              );
              return appearance === 'terms' ? (
                <Surface
                  as="section"
                  id={id}
                  key={id}
                  className="scroll-mt-space-2xl space-y-space-md lg:p-space-lg"
                >
                  {body}
                </Surface>
              ) : (
                <section
                  id={id}
                  key={id}
                  className="scroll-mt-space-2xl space-y-space-md"
                >
                  {body}
                </section>
              );
            },
          )}
          {children}
        </div>
      </div>
    </main>
  );
}

export function ContentCards({
  items,
}: {
  items: { title: string; body: string; icon?: ReactNode }[];
}) {
  return (
    <div className="grid gap-space-md sm:grid-cols-2">
      {items.map(({ title, body, icon }) => (
        <Surface key={title} className="space-y-space-sm">
          {icon && <div className="text-accent">{icon}</div>}
          <Text as="h3" variant="card-title">
            {title}
          </Text>
          <Text variant="body-secondary" tone="secondary">
            {body}
          </Text>
        </Surface>
      ))}
    </div>
  );
}

export function ResourceList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-space-xs pl-space-md">
      {items.map((item) => (
        <li key={item}>
          <Text as="span" tone="secondary">
            {item}
          </Text>
        </li>
      ))}
    </ul>
  );
}

export function ContactSupport({
  title = 'Contact QuizMB',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <Surface className="flex flex-col items-start gap-space-md bg-surface-low sm:flex-row sm:items-center">
      <Milo pose="message" className="w-24 shrink-0 sm:w-28" />
      <div className="min-w-0 flex-1 space-y-space-sm">
        <Text as="h3" variant="card-title">
          {title}
        </Text>
        <Text tone="secondary">
          {children ??
            'For account help, privacy questions, or questions about these policies, email us.'}
        </Text>
        <ResourceLink
          href={SUPPORT_MAILTO}
          icon={<Mail size={18} aria-hidden="true" className="shrink-0" />}
          className="h-auto min-h-control justify-start py-space-xs"
        >
          <Text
            as="span"
            variant="label"
            className="min-w-0 break-all text-left"
          >
            {SUPPORT_EMAIL}
          </Text>
        </ResourceLink>
      </div>
    </Surface>
  );
}
