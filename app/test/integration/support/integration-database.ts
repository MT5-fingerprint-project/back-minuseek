import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../../generated/prisma/client';

export const INTEGRATION_DATABASE_URL_ENV = 'INTEGRATION_DATABASE_URL';

//concurency test needs to keep N transactions open at the same time, all waiting for the same advisory lock: under-dimensioning the pool would make it wait for a connection instead of the lock, and the test would no longer prove anything.
const POOL_MAX = 24;

export interface IntegrationDatabase {
  client: PrismaClient;
  pool: Pool;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export async function openIntegrationDatabase(): Promise<IntegrationDatabase> {
  const connectionString = process.env[INTEGRATION_DATABASE_URL_ENV];
  if (!connectionString) {
    throw new Error(
      `${INTEGRATION_DATABASE_URL_ENV} manquante : la suite d'intégration se lance avec "make test-integration".`,
    );
  }

  const pool = new Pool({ connectionString, max: POOL_MAX });
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  await client.$connect();

  return {
    client,
    pool,
    reset: () => truncateAll(client),
    close: async () => {
      await client.$disconnect();
      await pool.end();
    },
  };
}

async function truncateAll(client: PrismaClient): Promise<void> {
  const tables = await client.$queryRaw<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) {
    return;
  }
  const quoted = tables.map((table) => `"${table.tablename}"`).join(', ');
  await client.$executeRawUnsafe(
    `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
  );
}
