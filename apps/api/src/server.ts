import { createServer } from 'node:http';
import type { Server } from 'socket.io';
import app, {
  authRepository,
  mediaMaintenance,
  database,
  events,
  live,
  logger,
  redis,
} from './index.js';
import { cleanUpAuth, startMaintenance } from './modules/auth/cleanup.js';
import { trimUsageEvents } from './modules/usage/allowances.js';
import { parseEnv } from './config/env.js';
import {
  attachLiveRealtime,
  createSocketServer,
} from './modules/live-sessions/realtime.js';
import { attachQuizStatusRealtime } from './modules/live-sessions/status-realtime.js';

// Long-running entry point (local development and Render). Socket.IO needs a
// persistent process, so it is attached here rather than in the app factory.
const env = parseEnv(process.env);
const server = createServer(app);
let io: Server | undefined;
let stopMaintenance: (() => void) | undefined;

async function start() {
  if (live && redis) {
    await redis.connect();
    io = createSocketServer(server, env.ALLOWED_ORIGINS);
    attachLiveRealtime(io, live, logger, events);
    attachQuizStatusRealtime(io, live, logger, events);
    // Presence from before the restart is stale; clients claim it again.
    const reset = await live.resetPresence();
    if (reset) logger.info({ sessions: reset }, 'Live presence reset');
    // Questions that were running when the process stopped close on time
    // (or at once if overdue) instead of waiting for the next interaction.
    const recovered = await live.recoverQuestionTimers();
    if (recovered) logger.info({ recovered }, 'Live question timers restored');
    // Lobby expiry, host grace and the maximum length are re-armed too.
    const deadlines = await live.recoverDeadlines();
    if (deadlines)
      logger.info({ deadlines }, 'Live session deadlines restored');
  } else {
    logger.warn('REDIS_URL is not set; live sessions are disabled');
  }
  // Hourly: never-verified accounts after 7 days, expired email and usage
  // events, abandoned uploads after 24 hours and orphaned images.
  stopMaintenance = startMaintenance(
    {
      auth: () => cleanUpAuth(authRepository),
      media: () => mediaMaintenance.cleanUp(),
      usage: () => trimUsageEvents(database),
    },
    logger,
  );
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
    stopMaintenance?.();
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
