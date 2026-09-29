import { createServer } from 'node:http';
import type { Server } from 'socket.io';
import app, { database, events, live, redis } from './index.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './infrastructure/logger.js';
import {
  attachLiveRealtime,
  createSocketServer,
} from './modules/live-sessions/realtime.js';
import { attachQuizStatusRealtime } from './modules/live-sessions/status-realtime.js';

// Long-running entry point (local development and Render). Socket.IO needs a
// persistent process, so it is attached here rather than in the app factory.
const env = parseEnv(process.env);
const logger = createLogger(env.LOG_LEVEL);
const server = createServer(app);
let io: Server | undefined;

async function start() {
  if (live && redis) {
    await redis.connect();
    io = createSocketServer(server, env.ALLOWED_ORIGINS);
    attachLiveRealtime(io, live, logger, events);
    attachQuizStatusRealtime(io, live, logger, events);
  } else {
    logger.warn('REDIS_URL is not set; live sessions are disabled');
  }
  server.listen(env.PORT, env.HOST, () =>
    logger.info({ port: env.PORT, host: env.HOST }, 'API listening'),
  );
}

server.on('error', () => {
  logger.error('API failed to listen');
  process.exitCode = 1;
});
start().catch(() => {
  logger.error('API failed to start');
  process.exit(1);
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'Stopping API');
    void io?.close();
    server.close(() => {
      void Promise.allSettled([database.$disconnect(), redis?.quit()]).finally(
        () => {
          process.exitCode = 0;
        },
      );
    });
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
