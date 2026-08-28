import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  PrismaClient,
  type SealRegistry,
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

  listTenants(): Promise<Tenant[]> {
    return this.client.tenant.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async recordSeals(
    seals: {
      tenantSlug: string;
      sha256: string;
      kind: SealRegistry['kind'];
      chainSeq: bigint;
      sealedAt: Date;
      anchoredAt: Date | null;
      caseId: string | null;
      reportType: string | null;
    }[],
  ): Promise<void> {
    if (seals.length === 0) {
      return;
    }
    await this.client.sealRegistry.createMany({
      data: seals,
      skipDuplicates: true,
    });
  }

  findSeal(tenantSlug: string, sha256: string): Promise<SealRegistry | null> {
    return this.client.sealRegistry.findUnique({
      where: { tenantSlug_sha256: { tenantSlug, sha256 } },
    });
  }

  findReportSealDates(
    tenantSlug: string,
    caseId: string,
    reportType: string,
  ): Promise<{ sealedAt: Date }[]> {
    return this.client.sealRegistry.findMany({
      where: { tenantSlug, caseId, reportType, kind: 'REPORT' },
      select: { sealedAt: true },
    });
  }

  async markSealsAnchored(
    tenantSlug: string,
    coveredThroughSeq: bigint,
    anchoredAt: Date,
  ): Promise<number> {
    const { count } = await this.client.sealRegistry.updateMany({
      where: {
        tenantSlug,
        anchoredAt: null,
        chainSeq: { lte: coveredThroughSeq },
      },
      data: { anchoredAt },
    });
    return count;
  }

  async deleteTenantBySlug(slug: string): Promise<Tenant | null> {
    const existing = await this.findTenantBySlug(slug);
    if (!existing) {
      return null;
    }
    return this.client.tenant.delete({ where: { slug } });
  }
}
