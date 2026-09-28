import { Router } from 'express';
import { z } from 'zod';
import { quizSchema } from '@quizmb/contracts';
import { validate } from '../auth/validation.js';
import type { QuizzesService } from './service.js';
export function quizRoutes(service: QuizzesService) {
  const r = Router();
  r.get('/projects/:id/quizzes', async (req, res) => {
    res.json({
      success: true,
      ...(await service.list(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(z.uuid().optional(), req.query.cursor),
      )),
    });
  });
  r.post('/projects/:id/quizzes', async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.create(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(quizSchema, req.body),
      ),
    });
  });
  r.get('/quizzes/:id', async (req, res) => {
    res.json({
      success: true,
      data: await service.get(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  r.patch('/quizzes/:id', async (req, res) => {
    res.json({
      success: true,
      data: await service.update(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(quizSchema, req.body),
      ),
    });
  });
  r.post('/quizzes/:id/publish', async (req, res) => {
    res.json({
      success: true,
      data: await service.publish(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  return r;
}

export function publicQuizRoutes(service: QuizzesService) {
  return Router().get('/public/quizzes/:publicId', async (req, res) => {
    res.json({
      success: true,
      data: await service.getPublic(
        validate(z.string().min(16).max(64), req.params.publicId),
      ),
    });
  });
}
