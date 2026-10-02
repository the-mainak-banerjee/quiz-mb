import type { QuizDto, RegistrationDto } from '@quizmb/contracts';
import { api } from './browser';
import { API_ROUTES } from './routes';

const auth = { authenticated: true };

export const publishingApi = {
  publish: (quizId: string) =>
    api.post<QuizDto>(`/api/quizzes/${quizId}/publish`, {}, auth),
  register: (quizId: string) =>
    api.post<RegistrationDto>(`/api/quizzes/${quizId}/register`, {}, auth),
  registration: (quizId: string) =>
    api.get<RegistrationDto>(API_ROUTES.QUIZZES.REGISTRATION(quizId), auth),
  unregister: (quizId: string) =>
    api.delete<RegistrationDto>(`/api/quizzes/${quizId}/register`, auth),
};
