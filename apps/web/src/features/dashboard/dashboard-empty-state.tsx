import { SquarePen, Activity, ShieldCheck } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { EmptyStateIllustration } from '@/components/empty-state-illustration';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';

export function DashboardEmptyState() {
  return (
    <Surface
      as="section"
      aria-labelledby="dashboard-empty-heading"
      className="flex flex-col items-center gap-space-md px-space-md py-space-xl text-center md:p-space-2xl"
    >
      <EmptyStateIllustration kind="quiz" />
      <div className="space-y-space-xs md:w-2/3 lg:w-1/2">
        <Text as="h2" id="dashboard-empty-heading" variant="section-heading">
          No quizzes hosted yet
        </Text>
        <Text tone="secondary">
          Interactive quizzes designed for high-signal team engagement. Build
          your first quiz and bring your team together.
        </Text>
      </div>
      <NavigationItem
        href={APP_LINKS.WORKSPACE.NEW_QUIZ}
        icon={<SquarePen size={18} aria-hidden="true" />}
        className="ds-primary-motion h-control w-full bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary md:w-auto"
      >
        Create your first quiz
      </NavigationItem>
      <div className="flex flex-wrap justify-center gap-space-md pt-space-lg md:gap-space-lg">
        <Text
          variant="caption"
          tone="secondary"
          className="flex items-center gap-space-xs"
        >
          <ShieldCheck size={18} className="text-accent" aria-hidden="true" />
          Live participation
        </Text>
        <Text
          variant="caption"
          tone="secondary"
          className="flex items-center gap-space-xs"
        >
          <Activity size={18} className="text-accent" aria-hidden="true" />
          Real-time team sync
        </Text>
      </div>
    </Surface>
  );
}
