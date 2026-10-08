import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { requestContext } from '../src/http/request-context.js';
import { errorHandler } from '../src/http/error-handler.js';
import { csrf } from '../src/http/csrf.js';
import { ApiError } from '../src/http/api-error.js';
import { ALERT } from '../src/infrastructure/alerts.js';
import { ERROR_CODE } from '@quizmb/contracts';

const logger = createLogger('silent');
async function withServer(
  app: ReturnType<typeof express>,
  run: (url: string) => Promise<void>,
) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('health, unknown routes, CORS, and request IDs', async () => {
  await withServer(
    createApp({ allowedOrigins: ['http://localhost:3000'], logger }),
    async (url) => {
      const health = await fetch(`${url}/api/health`, {
        headers: {
          Origin: 'http://localhost:3000',
          'X-Request-ID': 'untrusted-client-id',
        },
      });
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { status: 'ok' });
      assert.equal(
        health.headers.get('access-control-allow-origin'),
        'http://localhost:3000',
      );
      assert.equal(health.headers.get('cache-control'), 'no-store');
      assert.equal(
        health.headers.get('access-control-allow-credentials'),
        'true',
      );
      assert.equal(health.headers.get('x-powered-by'), null);
      assert.match(health.headers.get('x-request-id')!, /^[0-9a-f-]{36}$/);
      const blocked = await fetch(`${url}/api/health`, {
        headers: { Origin: 'https://untrusted.example' },
      });
      assert.equal(blocked.headers.get('access-control-allow-origin'), null);
      assert.equal(
        blocked.headers.get('access-control-allow-credentials'),
        null,
      );
      const preflight = await fetch(`${url}/api/health`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3000',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      assert.equal(preflight.status, 204);
      assert.match(
        preflight.headers.get('access-control-allow-methods')!,
        /POST/,
      );
      assert.equal(
        preflight.headers.get('access-control-allow-headers'),
        'content-type',
      );
      const missing = await fetch(`${url}/api/unknown`);
      assert.equal(missing.status, 404);
      const body = (await missing.json()) as {
        error: { code: string; requestId: string };
      };
      assert.equal(body.error.code, 'NOT_FOUND');
      assert.equal(body.error.requestId, missing.headers.get('x-request-id'));
      assert.notEqual(
        missing.headers.get('x-request-id'),
        health.headers.get('x-request-id'),
      );
      const business = await fetch(`${url}/api/auth/login`, { method: 'POST' });
      assert.equal(business.status, 404);
    },
  );
});

test('direct browser mutations require an exact allowed origin and JSON', async () => {
  const app = express();
  app.use(csrf(['https://app.quizmb.com']));
  app.post('/mutation', (_req, res) => res.json({ success: true }));
  app.use(errorHandler(logger));
  await withServer(app, async (url) => {
    for (const origin of [
      '',
      'https://evil.quizmb.com',
      'https://app.quizmb.com.evil.example',
    ]) {
      assert.equal(
        (
          await fetch(url + '/mutation', {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            body: '{}',
          })
        ).status,
        403,
      );
    }
    assert.equal(
      (
        await fetch(url + '/mutation', {
          method: 'POST',
          headers: {
            Origin: 'https://app.quizmb.com',
            'Content-Type': 'text/plain',
          },
          body: '{}',
        })
      ).status,
      415,
    );
    assert.equal(
      (
        await fetch(url + '/mutation', {
          method: 'POST',
          headers: {
            Origin: 'https://app.quizmb.com',
            'Content-Type': 'application/json',
          },
          body: '{}',
        })
      ).status,
      200,
    );
  });
});

test('central handler hides internal messages and stack traces', async () => {
  const app = express();
  app.use(requestContext(logger));
  // This throwing route exists only in the test app, never in the production API.
  app.get('/failure', () => {
    throw new Error('private-credential-and-stack');
  });
  app.use(errorHandler(logger));
  await withServer(app, async (url) => {
    const response = await fetch(`${url}/failure`);
    assert.equal(response.status, 500);
    const text = await response.text();
    assert.ok(!text.includes('private-credential-and-stack'));
    assert.ok(!text.includes('stack'));
    assert.equal(
      JSON.parse(text).error.requestId,
      response.headers.get('x-request-id'),
    );
  });
});

test('a saturated database answers 503 SERVICE_BUSY with Retry-After', async () => {
  const app = express();
  app.use(requestContext(logger));
  // Test-only routes: pg-pool's timeout and Prisma's transaction-start timeout.
  app.get('/pool', () => {
    throw new Error('timeout exceeded when trying to connect');
  });
  app.get('/transaction', () => {
    throw Object.assign(new Error('Transaction API error'), { code: 'P2028' });
  });
  // The Supabase pooler with all of its clients taken.
  app.get('/pooler', () => {
    throw new Error(
      '(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15',
    );
  });
  app.use(errorHandler(logger));
  await withServer(app, async (url) => {
    for (const path of ['/pool', '/transaction', '/pooler']) {
      const response = await fetch(`${url}${path}`);
      assert.equal(response.status, 503, path);
      assert.equal(response.headers.get('retry-after'), '2', path);
      const body = (await response.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'SERVICE_BUSY', path);
    }
  });
});

test('quota refusals are logged as alerts, with ids and no request body', async () => {
  const lines: Record<string, unknown>[] = [];
  const alerts = createLogger('info', {
    write: (line: string) => lines.push(JSON.parse(line)),
  });
  const app = express();
  app.use(requestContext(alerts));
  app.post('/limit', (_req, res) => {
    res.locals.userId = 'user-1';
    throw new ApiError(409, ERROR_CODE.LIMIT_REACHED, 'You have 3 projects.');
  });
  app.post('/invalid', () => {
    throw new ApiError(422, ERROR_CODE.VALIDATION_ERROR, 'Invalid.');
  });
  app.use(errorHandler(alerts));
  await withServer(app, async (url) => {
    assert.equal((await fetch(`${url}/limit`, { method: 'POST' })).status, 409);
    assert.equal(
      (await fetch(`${url}/invalid`, { method: 'POST' })).status,
      422,
    );
  });
  const refused = lines.filter((line) => line.alert);
  assert.equal(refused.length, 1, 'only the limit is an alert');
  assert.equal(refused[0]!.alert, ALERT.QUOTA_REFUSED);
  assert.equal(refused[0]!.userId, 'user-1');
  assert.equal(refused[0]!.code, ERROR_CODE.LIMIT_REACHED);
});
