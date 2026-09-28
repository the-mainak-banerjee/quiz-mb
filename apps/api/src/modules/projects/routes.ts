import { Router } from 'express';
import { z } from 'zod';
import { projectSchema } from '@quizmb/contracts';
import { validate } from '../auth/validation.js';
import type { ProjectsService } from './service.js';
export function projectRoutes(service: ProjectsService) {
  const r = Router();
  r.get('/projects', async (req, res) => {
    const cursor = validate(z.uuid().optional(), req.query.cursor);
    res.json({
      success: true,
      ...(await service.list(res.locals.userId as string, cursor)),
    });
  });
  r.post('/projects', async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.create(
        res.locals.userId as string,
        validate(projectSchema, req.body),
      ),
    });
  });
  r.get('/projects/:id', async (req, res) => {
    res.json({
      success: true,
      data: await service.get(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
      ),
    });
  });
  r.patch('/projects/:id', async (req, res) => {
    res.json({
      success: true,
      data: await service.update(
        validate(z.uuid(), req.params.id),
        res.locals.userId as string,
        validate(projectSchema, req.body),
      ),
    });
  });
  return r;
}
