import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../auth/validation.js';
import type { RegistrationsService } from './service.js';

export function registrationRoutes(service: RegistrationsService) {
  const router = Router();
  router.post('/quizzes/:id/register', async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.register(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  router.delete('/quizzes/:id/register', async (req, res) => {
    res.json({
      success: true,
      data: await service.unregister(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  router.get('/quizzes/:id/registration', async (req, res) => {
    res.json({
      success: true,
      data: await service.own(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  router.get('/quizzes/:id/registrations/all', async (req, res) => {
    res.json({
      success: true,
      data: await service.hostListAll(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  router.get('/quizzes/:id/registrations', async (req, res) => {
    const result = await service.hostList(
      validate(z.uuid(), req.params.id),
      res.locals.userId as string,
      validate(z.uuid().optional(), req.query.cursor),
      validate(
        z.coerce.number().int().min(1).max(100).default(50),
        req.query.limit,
      ),
    );
    res.json({ success: true, ...result });
  });
  router.get('/dashboard/participant', async (_req, res) => {
    res.json({
      success: true,
      data: await service.participantDashboard(res.locals.userId as string),
    });
  });
  router.get('/dashboard/host', async (_req, res) => {
    res.json({
      success: true,
      data: await service.hostDashboard(res.locals.userId as string),
    });
  });
  return router;
}
