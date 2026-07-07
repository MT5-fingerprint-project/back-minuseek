import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../../generated/prisma/client';
import { OrganizationInitializerPort } from '../../application/ports/organization-initializer.port';

@Injectable()
export class OrganizationInitializer implements OrganizationInitializerPort {
  async initialize(
    databaseName: string,
    slug: string,
    displayName: string,
  ): Promise<void> {
    const connectionString = requireEnv('TENANT_DATABASE_URL_TEMPLATE').replace(
      '{db}',
      databaseName,
    );
    const pool = new Pool({ connectionString, max: 1 });
    const prisma = this.instantiateClient(pool);
    try {
      const existing = await prisma.organization.findFirst();
      if (!existing) {
        await prisma.organization.create({
          data: { id: randomUUID(), slug, displayName },
        });
      }
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  }

  protected instantiateClient(pool: Pool): PrismaClient {
    return new PrismaClient({ adapter: new PrismaPg(pool) });
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}
