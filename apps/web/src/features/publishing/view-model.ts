import 'server-only';

import type { PublicQuizDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import type { PublishedQuizViewModel } from './types';

export function toPublishedQuizViewModel(
  quiz: PublicQuizDto,
  appOrigin: string,
): PublishedQuizViewModel {
  const planned = new Date(quiz.plannedStartAt);
  return {
    id: quiz.id,
    status: quiz.status,
    slug: quiz.publicId,
    title: quiz.title,
    description: quiz.description,
    project: quiz.project.name,
    host: quiz.host.name,
    plannedStartAt: quiz.plannedStartAt,
    date: planned.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    dateTileMonth: planned
      .toLocaleDateString(undefined, { month: 'short' })
      .toUpperCase(),
    dateTileDay: planned.toLocaleDateString(undefined, { day: 'numeric' }),
    time: planned.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
    cover: quiz.cover,
    registrationLimit: quiz.registrationLimit,
    registeredCount: quiz.registrationCount,
    publicUrl: `${appOrigin}${APP_LINKS.PUBLIC_QUIZ(quiz.publicId)}`,
  };
}
