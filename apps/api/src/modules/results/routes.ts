import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../auth/validation.js';
import type { ResultsService } from './service.js';

export function resultRoutes(service: ResultsService) {
  const router = Router();
  router.get('/quizzes/:id/results', async (req, res) => {
    res.json({
      success: true,
      data: await service.hostResults(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(z.coerce.number().int().min(0).default(0), req.query.offset),
      ),
    });
  });
  router.get('/live-sessions/:id/my-result', async (req, res) => {
    res.json({
      success: true,
      data: await service.participantResult(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  return router;
}
