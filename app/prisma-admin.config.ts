import { config } from 'dotenv';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

config({ path: resolve(__dirname, '..', '.env') });

export default defineConfig({
  schema: 'prisma-admin',
  migrations: {
    path: 'prisma-admin/migrations',
  },
  datasource: {
    url: process.env['ADMIN_DATABASE_URL'],
  },
});
