import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  PrismaClient,
  type Tenant,
} from '../../../../generated/prisma-admin/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const ADMIN_POOL_MAX = 4;

@Injectable()
export class AdminPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.ADMIN_DATABASE_URL;
    if (!connectionString) throw new Error('ADMIN_DATABASE_URL is not set');
    this.pool = new Pool({ connectionString, max: ADMIN_POOL_MAX });
    this.client = new PrismaClient({ adapter: new PrismaPg(this.pool) });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
    await this.pool.end();
  }

  findTenantBySlug(slug: string): Promise<Tenant | null> {
    return this.client.tenant.findUnique({ where: { slug } });
  }

  createTenant(record: {
    slug: string;
    displayName: string;
    databaseName: string;
    identityProviderRealm: string;
  }): Promise<Tenant> {
    return this.client.tenant.create({ data: record });
  }
}
