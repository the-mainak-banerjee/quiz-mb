import { ListChecks, Plus } from 'lucide-react';
import { Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import type { Quiz } from './types';
import { QuizList } from './quiz-list';

export function QuizzesView({ quizzes }: { quizzes: Quiz[] }) {
  return (
    <>
      <div className="flex flex-col gap-space-md md:flex-row md:items-end md:justify-between">
        <div className="space-y-space-xs">
          <Text
            variant="label"
            className="inline-flex items-center gap-space-xs uppercase text-accent"
          >
            <ListChecks size={16} aria-hidden="true" />
            Host &amp; participate
          </Text>
          <Text as="h1" variant="page-title">
            Quizzes
          </Text>
          <Text tone="secondary" className="max-w-2xl">
            Find every quiz you host or participate in, from drafts and
            registrations through live sessions and completed results.
          </Text>
        </div>
        <NavigationItem
          href={APP_LINKS.WORKSPACE.NEW_QUIZ}
          icon={<Plus size={18} aria-hidden="true" />}
          className="ds-primary-motion h-control w-full shrink-0 bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary md:w-auto"
        >
          Create quiz
        </NavigationItem>
      </div>
      <QuizList quizzes={quizzes} showViewAll={false} />
    </>
  );
}
