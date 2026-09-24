import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './infrastructure/logger.js';

const env = parseEnv(process.env);
export default createApp({
  allowedOrigins: env.ALLOWED_ORIGINS,
  logger: createLogger(env.LOG_LEVEL),
});
