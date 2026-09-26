import { ClipboardCheck, SquarePen, Activity, ShieldCheck } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { PreviewButton } from '@/components/workspace/preview-actions';

export function DashboardEmptyState() {
  return (
    <Surface
      as="section"
      aria-labelledby="dashboard-empty-heading"
      className="flex flex-col items-center gap-space-md px-space-md py-space-xl text-center md:p-space-2xl"
    >
      <div
        aria-hidden="true"
        className="relative rounded-card bg-surface-low p-space-md text-accent shadow-card"
      >
        <ClipboardCheck className="size-control" />
        <span className="ds-live-dot absolute bottom-0 right-0 size-space-sm rounded-pill bg-accent" />
      </div>
      <div className="space-y-space-xs md:w-2/3 lg:w-1/2">
        <Text as="h2" id="dashboard-empty-heading" variant="section-heading">
          No quizzes hosted yet
        </Text>
        <Text tone="secondary">
          Interactive quizzes designed for high-signal team engagement. Build
          your first quiz and bring your team together.
        </Text>
      </div>
      <PreviewButton action="Create quiz" className="w-full md:w-auto">
        <SquarePen size={18} aria-hidden="true" />
        Create your first quiz
      </PreviewButton>
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
