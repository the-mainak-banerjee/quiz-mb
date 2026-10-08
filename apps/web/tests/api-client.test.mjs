import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, ApiError } from '../src/lib/api/client.ts';
import { API_ROUTES } from '../src/lib/api/routes.ts';

const baseUrl = 'https://api.quizmb.com';
const json = (value, status = 200) => Response.json(value, { status });
const denied = () =>
  json(
    {
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Please sign in.' },
    },
    401,
  );
const unauthenticated = () =>
  json(
    {
      success: false,
      error: { code: 'UNAUTHENTICATED', message: 'Wrong email or password.' },
    },
    401,
  );

test('all HTTP methods use the API origin, credentials, JSON and typed envelope data', async () => {
  const calls = [];
  const api = createApiClient({
    baseUrl,
    fetcher: async (url, init) => {
      calls.push({ url: String(url), ...init });
      return json({ success: true, data: { id: 1 } });
    },
  });
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const result = ['post', 'put', 'patch'].includes(method)
      ? await api[method]('/api/example', { name: 'Example' })
      : await api[method]('/api/example');
    assert.deepEqual(result, { id: 1 });
  }
  assert.deepEqual(
    calls.map((call) => call.method),
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  );
  for (const call of calls) {
    assert.equal(call.url, baseUrl + '/api/example');
    assert.equal(call.credentials, 'include');
    assert.equal(call.cache, 'no-store');
    assert.equal(call.redirect, 'error');
  }
  assert.equal(calls[1].headers.get('Content-Type'), 'application/json');
  assert.equal(calls[1].body, JSON.stringify({ name: 'Example' }));
});

test('health JSON and 204 responses work without an envelope', async () => {
  const api = createApiClient({
    baseUrl,
    fetcher: async (url) =>
      String(url).endsWith('/health')
        ? json({ status: 'ok' })
        : new Response(null, { status: 204 }),
  });
  assert.deepEqual(await api.get(API_ROUTES.HEALTH), { status: 'ok' });
  assert.equal(await api.delete('/api/example'), undefined);
});

test('validation details and request IDs are centralized; 500 messages are safe', async () => {
  const api = createApiClient({
    baseUrl,
    fetcher: async () =>
      json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: { email: 'Invalid email', privateObject: {} },
            requestId: 'req-1',
          },
        },
        400,
      ),
  });
  await assert.rejects(
    api.post('/api/example'),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.message === 'Invalid input' &&
      error.requestId === 'req-1' &&
      error.details.email === 'Invalid email' &&
      !('privateObject' in error.details),
  );
  const broken = createApiClient({
    baseUrl,
    fetcher: async () =>
      json({ error: { message: 'private database information' } }, 500),
  });
  await assert.rejects(
    broken.get('/api/example'),
    (error) => !error.message.includes('private database'),
  );
});

test('non-JSON, malformed envelopes and network failures become consistent errors', async () => {
  for (const response of [
    new Response('<html>Bad gateway</html>', { status: 502 }),
    json({ success: true }),
  ]) {
    const api = createApiClient({ baseUrl, fetcher: async () => response });
    await assert.rejects(api.get('/api/example'), { code: 'INVALID_RESPONSE' });
  }
  let calls = 0;
  const api = createApiClient({
    baseUrl,
    fetcher: async () => {
      calls++;
      throw new TypeError('private network detail');
    },
  });
  await assert.rejects(api.post('/api/example'), { code: 'NETWORK_ERROR' });
  assert.equal(calls, 1);
});

test('cancellation and timeouts do not retry mutations', async () => {
  const fetcher = async (_url, { signal }) => {
    signal.throwIfAborted();
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      }),
    );
  };
  const api = createApiClient({ baseUrl, fetcher, timeoutMs: 10 });
  // Keep the test process alive while AbortSignal's unref'ed timeout runs.
  const timer = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(api.post('/api/example'), { code: 'TIMEOUT' });
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      api.get('/api/example', { signal: controller.signal }),
      { code: 'ABORTED' },
    );
  } finally {
    clearTimeout(timer);
  }
});

test('concurrent protected calls coordinate one refresh and retry once', async () => {
  let refreshed = false,
    refreshes = 0,
    requests = 0;
  const api = createApiClient({
    baseUrl,
    refresh: async () => {
      refreshes++;
      refreshed = true;
    },
    fetcher: async () => {
      requests++;
      return refreshed ? json({ success: true, data: 'ok' }) : denied();
    },
  });
  assert.deepEqual(
    await Promise.all([
      api.get(API_ROUTES.AUTH.ME, { authenticated: true }),
      api.get(API_ROUTES.AUTH.ME, { authenticated: true }),
    ]),
    ['ok', 'ok'],
  );
  assert.equal(refreshes, 1);
  assert.equal(requests, 4);
});

test('an expired access token is renewed and retried on every call', async () => {
  let refreshed = false,
    refreshes = 0;
  const api = createApiClient({
    baseUrl,
    refresh: async () => {
      refreshes++;
      refreshed = true;
    },
    fetcher: async () =>
      refreshed ? json({ success: true, data: 'saved' }) : denied(),
  });
  // No `authenticated` option: TOKEN_EXPIRED alone is enough.
  assert.equal(await api.patch(API_ROUTES.AUTH.ME, { name: 'A' }), 'saved');
  assert.equal(refreshes, 1);
});

test('other 401s renew only for calls marked authenticated', async () => {
  let refreshes = 0;
  const api = createApiClient({
    baseUrl,
    refresh: async () => {
      refreshes++;
    },
    fetcher: async () => unauthenticated(),
  });
  await assert.rejects(api.get(API_ROUTES.AUTH.ME), { status: 401 });
  assert.equal(refreshes, 0);
  await assert.rejects(api.get(API_ROUTES.AUTH.ME, { authenticated: true }), {
    status: 401,
  });
  assert.equal(refreshes, 1, 'renewed once, retried once, then refused');
});

test('login does not refresh; refresh failure and repeated 401 cannot loop', async () => {
  let refreshes = 0,
    calls = 0;
  const api = createApiClient({
    baseUrl,
    refresh: async () => {
      refreshes++;
    },
    fetcher: async (url) => {
      calls++;
      // Login answers a wrong password with UNAUTHENTICATED, never TOKEN_EXPIRED.
      return String(url).endsWith(API_ROUTES.AUTH.LOGIN)
        ? unauthenticated()
        : denied();
    },
  });
  await assert.rejects(api.post(API_ROUTES.AUTH.LOGIN, {}), { status: 401 });
  assert.equal(refreshes, 0);
  await assert.rejects(api.get(API_ROUTES.AUTH.ME, { authenticated: true }), {
    status: 401,
  });
  assert.equal(refreshes, 1);
  assert.equal(calls, 3);
  const failed = createApiClient({
    baseUrl,
    refresh: async () => {
      throw new ApiError('Sign in again', 401);
    },
    fetcher: async () => denied(),
  });
  await assert.rejects(
    failed.get(API_ROUTES.AUTH.ME, { authenticated: true }),
    {
      message: 'Sign in again',
    },
  );
});

test('server clients isolate cookies and reject external or escaped paths', async () => {
  const seen = [];
  const fetcher = async (_url, init) => {
    seen.push(init.headers.get('Cookie'));
    return json({ success: true, data: {} });
  };
  const a = createApiClient({
    baseUrl,
    headers: { Cookie: 'user=a' },
    fetcher,
  });
  const b = createApiClient({
    baseUrl,
    headers: { Cookie: 'user=b' },
    fetcher,
  });
  await Promise.all([a.get(API_ROUTES.AUTH.ME), b.get(API_ROUTES.AUTH.ME)]);
  assert.deepEqual(seen, ['user=a', 'user=b']);
  for (const path of [
    'https://evil.example/api/me',
    '//evil.example/api/me',
    '/api/../../elsewhere',
  ])
    await assert.rejects(a.get(path), { code: 'INVALID_REQUEST' });
  assert.equal(seen.length, 2);
});

test('a busy server is retried after Retry-After (capped), then succeeds or gives up', async () => {
  const busy = () =>
    new Response(
      JSON.stringify({
        success: false,
        error: { code: 'SERVICE_BUSY', message: 'The server is busy.' },
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '9' },
      },
    );
  const waits = [];
  let retries = 0;
  let replies = [busy(), busy(), json({ success: true, data: { ok: 1 } })];
  const api = createApiClient({
    baseUrl,
    fetcher: async () => replies.shift(),
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
  assert.deepEqual(
    await api.post('/api/example', {}, { onBusyRetry: () => (retries += 1) }),
    { ok: 1 },
  );
  assert.deepEqual(waits, [5000, 5000], 'Retry-After is capped at 5 s');
  assert.equal(retries, 2);

  replies = [busy(), busy(), busy(), json({ success: true, data: {} })];
  await assert.rejects(api.post('/api/example', {}), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'SERVICE_BUSY');
    assert.equal(error.status, 503);
    assert.match(error.message, /busy/);
    return true;
  });
  assert.equal(replies.length, 1, 'two retries, then the error');
});

test('rate-limited answers explain the wait and are never retried', async () => {
  let calls = 0;
  const limited = (retryAfter) =>
    createApiClient({
      baseUrl,
      fetcher: async () => {
        calls += 1;
        return new Response(
          JSON.stringify({
            success: false,
            error: { code: 'RATE_LIMITED', message: 'Too many requests.' },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
            },
          },
        );
      },
    });
  const message = async (retryAfter) => {
    try {
      await limited(retryAfter).post('/api/auth/login', {});
    } catch (error) {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'RATE_LIMITED');
      return error.message;
    }
  };
  assert.equal(
    await message('840'),
    'Too many attempts. Try again in 14 minutes.',
  );
  assert.equal(
    await message('30'),
    'Too many attempts. Try again in 30 seconds.',
  );
  assert.equal(
    await message(undefined),
    'Too many attempts. Try again shortly.',
  );
  assert.equal(calls, 3, 'one request each');
});
