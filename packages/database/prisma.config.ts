import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Client generation/builds do not require database credentials.
  // Database commands still require DIRECT_DATABASE_URL.
  ...(process.env.DIRECT_DATABASE_URL
    ? { datasource: { url: process.env.DIRECT_DATABASE_URL } }
    : {}),
});
