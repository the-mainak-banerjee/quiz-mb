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
