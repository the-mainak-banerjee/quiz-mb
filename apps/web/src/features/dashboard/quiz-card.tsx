import {
  ArrowRight,
  CalendarDays,
  Clock3,
  UsersRound,
  Settings2,
  Pencil,
  Eye,
  ChartNoAxesCombined,
  ListChecks,
} from 'lucide-react';
import { Badge, Surface, Text } from '@/components/ui';
import { RoleIndicator } from './indicators';
import { PreviewButton } from '@/components/workspace/preview-actions';
import { NavigationItem } from '@/components/workspace/navigation-item';
import type { Quiz } from './types';
import { cn } from '@/lib/utils';

export function QuizCard({
  quiz,
  featured = false,
  actionHref,
}: {
  quiz: Quiz;
  featured?: boolean;
  actionHref?: string;
}) {
  const ActionIcon =
    quiz.status === 'live'
      ? ArrowRight
      : quiz.status === 'draft'
        ? Pencil
        : quiz.status === 'completed'
          ? ChartNoAxesCombined
          : quiz.role === 'host'
            ? Settings2
            : Eye;
  const TimingIcon = quiz.status === 'live' || featured ? Clock3 : CalendarDays;
  const DetailIcon = quiz.detail.endsWith('questions')
    ? ListChecks
    : UsersRound;
  return (
    <Surface as="article" className="flex h-full min-w-0 flex-col">
      <div className="flex flex-1 flex-col">
        <div className="mb-space-sm flex flex-wrap items-center justify-between gap-space-xs">
          <RoleIndicator role={quiz.role} expanded={featured} />
          <Badge
            variant={quiz.status}
            {...(quiz.statusLabel ? { label: quiz.statusLabel } : {})}
          />
        </div>
        <div className="space-y-space-xs">
          <Text
            as={featured ? 'h2' : 'h3'}
            variant={featured ? 'section-heading' : 'card-title'}
          >
            {quiz.title}
          </Text>
          <Text variant="body-secondary" tone="secondary">
            {quiz.description}
          </Text>
          <Text
            as="span"
            variant="caption"
            tone="secondary"
            className="inline-flex w-fit rounded-sm bg-surface-muted px-badge-x py-badge-y"
          >
            {quiz.project}
          </Text>
        </div>
      </div>
      <div className="mt-space-md shrink-0 border-t border-border-surface pt-space-md">
        <div className="mb-space-sm flex flex-wrap items-center justify-between gap-space-xs">
          <Text
            as="span"
            variant="caption"
            tone="secondary"
            className="inline-flex items-center gap-space-xs"
          >
            <TimingIcon size={16} aria-hidden="true" />
            {quiz.timing}
          </Text>
          {quiz.detail && (
            <Text
              as="span"
              variant="caption"
              tone="secondary"
              className="inline-flex items-center gap-space-xs"
            >
              <DetailIcon size={16} aria-hidden="true" />
              {quiz.detail}
            </Text>
          )}
        </div>
        {actionHref ? (
          <NavigationItem
            href={actionHref}
            icon={<ActionIcon size={16} aria-hidden="true" />}
            iconPosition={quiz.status === 'live' ? 'right' : 'left'}
            className={cn(
              'h-control w-full',
              quiz.status === 'live'
                ? 'ds-primary-motion bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary'
                : 'bg-action-secondary text-accent hover:bg-action-secondary-hover hover:text-accent',
            )}
          >
            {quiz.action}
          </NavigationItem>
        ) : (
          <PreviewButton
            action={quiz.action}
            variant={quiz.status === 'live' ? 'primary' : 'secondary'}
            icon={<ActionIcon size={16} aria-hidden="true" />}
            iconPosition={quiz.status === 'live' ? 'right' : 'left'}
            className="w-full"
          >
            {quiz.action}
          </PreviewButton>
        )}
      </div>
    </Surface>
  );
}
