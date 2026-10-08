import { Router } from 'express';
import { z } from 'zod';
import { uploadSchema } from '@quizmb/contracts';
import { validate } from '../auth/validation.js';
import type { MediaService } from './service.js';
export function mediaRoutes(service: MediaService) {
  const r = Router();
  r.post('/media/upload-request', async (req, res) => {
    res.status(201).json({
      success: true,
      data: await service.request(
        res.locals.userId as string,
        validate(uploadSchema, req.body),
      ),
    });
  });
  r.delete('/media/:id', async (req, res) => {
    await service.remove(
      validate(z.uuid(), req.params.id),
      res.locals.userId as string,
    );
    res.status(204).end();
  });
  return r;
}
