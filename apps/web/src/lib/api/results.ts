import type { HostQuizResultsDto } from '@quizmb/contracts';
import { api } from './browser';
import { API_ROUTES } from './routes';

export const resultsApi = {
  /** One page of a completed quiz's ranked results (host only). */
  hostResults: (quizId: string, offset: number) =>
    api.get<HostQuizResultsDto>(API_ROUTES.QUIZZES.RESULTS(quizId, offset), {
      authenticated: true,
    }),
};
