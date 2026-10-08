import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import { ACCOUNT_LIMITS, ERROR_CODE, type ProjectDto } from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';
import { signUpVerified } from './auth-helper.js';

// Security design 1.4: a fixed number of projects per account, enforced
// atomically, with deleting a project freeing a slot.
test(
  'projects are limited per account, even under simultaneous creation',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const mailbox = new MemoryMailbox();
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth: new AuthService(new AuthRepository(db), config, mailbox),
      users: new UsersService(db),
      database: db,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const run = randomUUID();
    const emailOf = (who: string) => `projects-${who}-${run}@example.invalid`;
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      const where = { email: { endsWith: `-${run}@example.invalid` } };
      await db.project.deleteMany({ where: { owner: where } });
      await db.user.deleteMany({ where });
      await db.$disconnect();
    });
    const request = (
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
    ) =>
      fetch(`${base}/api${path}`, {
        method,
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const signUp = async (who: string) => {
      const response = await signUpVerified(request, mailbox, {
        name: `Projects ${who}`,
        email: emailOf(who),
        password: 'a sufficiently long projects password',
      });
      assert.equal(response.status, 200);
      return response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    };
    const create = (cookie: string, name: string) =>
      request('/projects', 'POST', { name, description: '' }, cookie);

    // ---- Up to the limit, then a clear refusal.
    const owner = await signUp('owner');
    const created: ProjectDto[] = [];
    for (let i = 0; i < ACCOUNT_LIMITS.projects; i++) {
      const response = await create(owner, `Project ${i + 1}`);
      assert.equal(response.status, 201);
      created.push(((await response.json()) as { data: ProjectDto }).data);
    }
    const over = await create(owner, 'One too many');
    assert.equal(over.status, 409);
    const body = (await over.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(body.error.code, ERROR_CODE.LIMIT_REACHED);
    assert.match(body.error.message, /up to 3 projects/);

    // ---- Deleting a project frees a slot.
    assert.equal(
      (await request(`/projects/${created[0]!.id}`, 'DELETE', undefined, owner))
        .status,
      204,
    );
    assert.equal((await create(owner, 'Replacement')).status, 201);
    assert.equal((await create(owner, 'Still too many')).status, 409);

    // ---- Simultaneous creations cannot pass the limit.
    const racer = await signUp('racer');
    for (let i = 0; i < ACCOUNT_LIMITS.projects - 1; i++)
      assert.equal((await create(racer, `Racer ${i + 1}`)).status, 201);
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) => create(racer, `Burst ${i + 1}`)),
    );
    assert.deepEqual(
      results.map((response) => response.status).sort(),
      [201, 409, 409, 409],
    );
    const racerUser = await db.user.findUniqueOrThrow({
      where: { email: emailOf('racer') },
    });
    assert.equal(
      await db.project.count({ where: { ownerUserId: racerUser.id } }),
      ACCOUNT_LIMITS.projects,
    );
  },
);
