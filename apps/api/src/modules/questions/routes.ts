import { Router } from 'express';
import { z } from 'zod';
import { questionSchema, reorderSchema } from '@quizmb/contracts';
import { validate } from '../auth/validation.js';
import type { QuestionsService } from './service.js';
export function questionRoutes(service: QuestionsService) {
  const r = Router();
  r.post('/quizzes/:id/questions', async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.create(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(questionSchema, req.body),
      ),
    });
  });
  r.patch('/questions/:id', async (req, res) => {
    res.json({
      success: true,
      data: await service.update(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(questionSchema, req.body),
      ),
    });
  });
  r.delete('/questions/:id', async (req, res) => {
    res.json({
      success: true,
      data: await service.remove(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  r.post('/quizzes/:id/questions/reorder', async (req, res) => {
    res.json({
      success: true,
      data: await service.reorder(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(reorderSchema, req.body).questionIds,
      ),
    });
  });
  return r;
}
