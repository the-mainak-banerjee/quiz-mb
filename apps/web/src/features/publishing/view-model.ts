import 'server-only';

import type { PublicQuizDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import type { PublishedQuizViewModel } from './types';

// The planned start stays an ISO timestamp: it is formatted in the viewer's
// browser, since the server's locale and time zone may differ.
export function toPublishedQuizViewModel(
  quiz: PublicQuizDto,
  appOrigin: string,
): PublishedQuizViewModel {
  return {
    id: quiz.id,
    status: quiz.status,
    slug: quiz.publicId,
    title: quiz.title,
    description: quiz.description,
    project: quiz.project.name,
    host: quiz.host.name,
    plannedStartAt: quiz.plannedStartAt,
    cover: quiz.cover,
    registrationLimit: quiz.registrationLimit,
    registeredCount: quiz.registrationCount,
    publicUrl: `${appOrigin}${APP_LINKS.PUBLIC_QUIZ(quiz.publicId)}`,
  };
}
