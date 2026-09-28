import { Router } from 'express';
import type { PrismaClient } from '@quizmb/database';
import { ProjectsRepository } from './projects/repository.js';
import { ProjectsService } from './projects/service.js';
import { projectRoutes } from './projects/routes.js';
import { QuizzesRepository } from './quizzes/repository.js';
import { QuizzesService } from './quizzes/service.js';
import { quizRoutes } from './quizzes/routes.js';
import { QuestionsRepository } from './questions/repository.js';
import { QuestionsService } from './questions/service.js';
import { questionRoutes } from './questions/routes.js';
import { MediaService } from './media/service.js';
import { mediaRoutes } from './media/routes.js';
import type { SupabaseStorage } from './media/storage.js';
export function authoringRoutes(db: PrismaClient, storage?: SupabaseStorage) {
  const projects = new ProjectsService(new ProjectsRepository(db));
  const media = new MediaService(db, storage);
  const quizzes = new QuizzesService(
    new QuizzesRepository(db),
    media,
    projects,
  );
  const questions = new QuestionsService(new QuestionsRepository(db), quizzes);
  return Router().use(
    projectRoutes(projects),
    quizRoutes(quizzes),
    questionRoutes(questions),
    mediaRoutes(media),
  );
}
