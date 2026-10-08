import { Router } from 'express';
import type { PrismaClient } from '@quizmb/database';
import { ProjectsRepository } from './projects/repository.js';
import { ProjectsService } from './projects/service.js';
import { projectRoutes } from './projects/routes.js';
import { QuizzesRepository } from './quizzes/repository.js';
import { QuizzesService } from './quizzes/service.js';
import { publicQuizRoutes, quizRoutes } from './quizzes/routes.js';
import { QuestionsRepository } from './questions/repository.js';
import { QuestionsService } from './questions/service.js';
import { questionRoutes } from './questions/routes.js';
import { MediaService } from './media/service.js';
import { mediaRoutes } from './media/routes.js';
import type { SupabaseStorage } from './media/storage.js';
import { RegistrationsRepository } from './registrations/repository.js';
import { RegistrationsService } from './registrations/service.js';
import { registrationRoutes } from './registrations/routes.js';
import type { Logger } from 'pino';
import type { DomainEvents } from '../infrastructure/domain-events.js';
import { ResultsRepository } from './results/repository.js';
import { ResultsService } from './results/service.js';
import { resultRoutes } from './results/routes.js';
export function authoringRoutes(
  db: PrismaClient,
  storage?: SupabaseStorage,
  events?: DomainEvents,
  logger?: Logger,
) {
  const media = new MediaService(db, storage, logger);
  const projects = new ProjectsService(new ProjectsRepository(db), media);
  const quizzes = new QuizzesService(
    new QuizzesRepository(db),
    media,
    projects,
  );
  const questions = new QuestionsService(
    new QuestionsRepository(db),
    quizzes,
    media,
  );
  const results = new ResultsService(new ResultsRepository(db));
  const registrations = new RegistrationsService(
    new RegistrationsRepository(db),
    quizzes,
    events,
    results,
  );
  return Router().use(
    projectRoutes(projects),
    quizRoutes(quizzes),
    questionRoutes(questions),
    registrationRoutes(registrations),
    resultRoutes(results),
    mediaRoutes(media),
  );
}

export function publicAuthoringRoutes(
  db: PrismaClient,
  storage?: SupabaseStorage,
) {
  const projects = new ProjectsService(new ProjectsRepository(db));
  const media = new MediaService(db, storage);
  const quizzes = new QuizzesService(
    new QuizzesRepository(db),
    media,
    projects,
  );
  return publicQuizRoutes(quizzes);
}
