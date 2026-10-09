import 'server-only';
import { cache } from 'react';
import type { PublicQuizDto } from '@quizmb/contracts';
import { createApiClient } from './client';
import { API_ORIGIN } from './config';
import { API_ROUTES } from './routes';

/** The public endpoint only: no visitor cookies, session refresh, or auth redirect. */
export const getPublicQuiz = cache((publicId: string) =>
  createApiClient({ baseUrl: API_ORIGIN }).get<PublicQuizDto>(
    API_ROUTES.PUBLIC_QUIZ(publicId),
  ),
);
