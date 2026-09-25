import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './infrastructure/logger.js';
import { createDatabase } from '@quizmb/database';
import { parseAuthEnv } from './modules/auth/config.js';
import { AuthRepository } from './modules/auth/repository.js';
import { AuthService } from './modules/auth/service.js';
import { UsersService } from './modules/users/service.js';

const env = parseEnv(process.env);
const authConfig = parseAuthEnv(process.env);
export const database = createDatabase(
  authConfig.DATABASE_URL,
  authConfig.DATABASE_SSL_CA_BASE64,
);
export default createApp({
  allowedOrigins: env.ALLOWED_ORIGINS,
  logger: createLogger(env.LOG_LEVEL),
  auth: new AuthService(new AuthRepository(database), authConfig),
  users: new UsersService(database),
  production: env.NODE_ENV === 'production',
});
