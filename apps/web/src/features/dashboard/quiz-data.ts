import 'server-only';

import {
  type HostDashboardDto,
  type HostDashboardQuizDto,
  type ParticipantDashboardDto,
  type PublicQuizDto,
  QUIZ_STATUS,
} from '@quizmb/contracts';
import { API_ROUTES } from '@/lib/api/routes';
import { loadApi } from '@/lib/api/server';
import type { Quiz } from './types';

function hostQuiz(quiz: HostDashboardQuizDto): Quiz {
  const status: Quiz['status'] =
    quiz.status === QUIZ_STATUS.DRAFT
      ? 'draft'
      : quiz.status === QUIZ_STATUS.COMPLETED
        ? 'completed'
        : quiz.status === QUIZ_STATUS.LIVE || quiz.status === QUIZ_STATUS.LOBBY
          ? 'live'
          : 'scheduled';
  const planned = quiz.plannedStartAt
    ? new Date(quiz.plannedStartAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : `Updated ${new Date(quiz.updatedAt).toLocaleDateString()}`;

  return {
    id: quiz.id,
    project: quiz.projectName,
    role: 'host',
    status,
    ...(status === 'scheduled' ? { statusLabel: 'Published' } : {}),
    title: quiz.title,
    description:
      quiz.description || 'Manage this quiz and prepare its live session.',
    timing: planned,
    detail:
      status === 'scheduled' || status === 'live'
        ? `${quiz.registrationCount} registered`
        : `${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'}`,
    action:
      status === 'draft'
        ? 'Edit Draft'
        : status === 'completed'
          ? 'View Results'
          : status === 'live'
            ? 'Launch Room'
            : 'Manage',
  };
}

function participantQuiz(quiz: PublicQuizDto): Quiz {
  const status: Quiz['status'] =
    quiz.status === QUIZ_STATUS.COMPLETED
      ? 'completed'
      : quiz.status === QUIZ_STATUS.LIVE || quiz.status === QUIZ_STATUS.LOBBY
        ? 'live'
        : 'scheduled';

  return {
    id: quiz.id,
    publicId: quiz.publicId,
    project: quiz.project.name,
    role: 'participant',
    status,
    statusLabel:
      status === 'completed'
        ? 'Completed'
        : status === 'live'
          ? 'Live Now'
          : 'Registered',
    title: quiz.title,
    description: `Hosted by ${quiz.host.name} · Room opens when the host starts.`,
    timing: new Date(quiz.plannedStartAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
    detail: `${quiz.registrationCount} registered`,
    action:
      status === 'completed'
        ? 'View Results'
        : status === 'live'
          ? 'Join Quiz'
          : 'View Details',
  };
}

export async function loadUserQuizData() {
  const [host, participant] = await Promise.all([
    loadApi<HostDashboardDto>(API_ROUTES.DASHBOARD.HOST),
    loadApi<ParticipantDashboardDto>(API_ROUTES.DASHBOARD.PARTICIPANT),
  ]);
  const participantQuizzes = [
    ...participant.upcoming,
    ...participant.live,
    ...participant.history,
  ].map(participantQuiz);

  const quizzes = [...host.quizzes.map(hostQuiz), ...participantQuizzes];
  const byId = new Map<string, Quiz>();
  for (const quiz of quizzes) {
    const current = byId.get(quiz.id);
    if (!current || quiz.role === 'host') byId.set(quiz.id, quiz);
  }

  return {
    projects: host.projects,
    quizzes: [...byId.values()],
  };
}
