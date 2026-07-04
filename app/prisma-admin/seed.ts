/**
 * Amorce le registre local avec le tenant de démo (upsert, rejouable).
 *
 * Local uniquement (`make seed-admin`) : en déployé, les tenants naissent par
 * la commande de provisioning (SUP-03), jamais par un seed.
 */
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma-admin/client';

const DEMO_TENANT = {
  slug: 'tenant-demo',
  displayName: 'Tenant démo',
  databaseName: process.env.DB_NAME ?? 'minuseek_dev',
  identityProviderRealm: 'minuseek-tenant-demo',
};

async function main() {
  const connectionString = process.env.ADMIN_DATABASE_URL;
  if (!connectionString) {
    throw new Error('ADMIN_DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString, max: 1 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const tenant = await prisma.tenant.upsert({
      where: { slug: DEMO_TENANT.slug },
      update: {
        displayName: DEMO_TENANT.displayName,
        databaseName: DEMO_TENANT.databaseName,
        identityProviderRealm: DEMO_TENANT.identityProviderRealm,
      },
      create: DEMO_TENANT,
    });
    console.log(
      `Registre amorcé : ${tenant.slug} → db=${tenant.databaseName}, realm=${tenant.identityProviderRealm}`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
