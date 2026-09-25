import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client.js';
export { Prisma, PrismaClient } from './generated/client.js';
export type { User, AuthSession } from './generated/client.js';
export function createDatabase(connectionString: string, caBase64?: string) {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const url = new URL(connectionString);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  // Driver connection-string SSL options otherwise override the explicit CA.
  // Remote databases always verify both certificate and hostname.
  for (const key of [
    'sslmode',
    'sslcert',
    'sslkey',
    'sslrootcert',
    'ssl',
    'uselibpqcompat',
  ])
    url.searchParams.delete(key);
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url.toString(),
      ssl: local
        ? false
        : {
            rejectUnauthorized: true,
            ...(caBase64
              ? { ca: Buffer.from(caBase64, 'base64').toString('utf8') }
              : {}),
          },
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    }),
  });
}
