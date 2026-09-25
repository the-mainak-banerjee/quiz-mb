import app, { database } from './index.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './infrastructure/logger.js';

const env = parseEnv(process.env);
const logger = createLogger(env.LOG_LEVEL);
const server = app.listen(env.PORT, env.HOST, () =>
  logger.info({ port: env.PORT, host: env.HOST }, 'API listening'),
);
server.on('error', () => {
  logger.error('API failed to listen');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'Stopping API');
    server.close(() => {
      void database.$disconnect().finally(() => {
        process.exitCode = 0;
      });
    });
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
