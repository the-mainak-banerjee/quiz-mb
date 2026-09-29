import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../auth/validation.js';
import type { LiveSessionsService } from './service.js';

export function liveSessionRoutes(service: LiveSessionsService) {
  const router = Router();
  router.post('/quizzes/:id/live-session', async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.openLobby(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  router.get('/quizzes/:id/live-session', async (req, res) => {
    res.json({
      success: true,
      data: await service.currentForQuiz(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  router.get('/live-sessions/active', async (_req, res) => {
    res.json({
      success: true,
      data: await service.activeForHost(res.locals.userId as string),
    });
  });
  router.post('/live-sessions/:id/socket-ticket', async (req, res) => {
    res.json({
      success: true,
      data: await service.issueTicket(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  return router;
}
