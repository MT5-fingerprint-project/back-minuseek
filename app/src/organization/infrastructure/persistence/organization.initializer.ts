import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../../generated/prisma/client';
import {
  OrganizationInitializerPort,
  OrganizationToInitialize,
} from '../../application/ports/organization-initializer.port';
import { TransactionContextService } from '../../../tenancy/infrastructure/persistence/transaction-context.service';
import { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import {
  AUDIT_TRAIL,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';

const PROVISIONER = AuditActor.system('provisioner');

@Injectable()
export class OrganizationInitializer implements OrganizationInitializerPort {
  constructor(
    private readonly transactionContext: TransactionContextService,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async initialize(organization: OrganizationToInitialize): Promise<void> {
    const connectionString = requireEnv('TENANT_DATABASE_URL_TEMPLATE').replace(
      '{db}',
      organization.databaseName,
    );
    const pool = new Pool({ connectionString, max: 1 });
    const prisma = this.instantiateClient(pool);
    try {
      await prisma.$transaction((transaction) =>
        this.transactionContext.run(transaction, async () => {
          const existing = await transaction.organization.findFirst();
          if (existing) {
            return;
          }
          await transaction.organization.create({
            data: {
              id: randomUUID(),
              slug: organization.slug,
              displayName: organization.displayName,
            },
          });
          await this.auditTrail.append({
            eventType: AuditEventTypeEnum.TENANT_PROVISIONED,
            evidenceClass: EvidenceClassEnum.OBSERVED,
            actor: PROVISIONER,
            payload: {
              slug: organization.slug,
              displayName: organization.displayName,
              realm: organization.realm,
            },
          });
        }),
      );
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
