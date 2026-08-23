import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import type { InvestigationCaseRepository } from '../../domain/investigation-case/repository/investigation-case.repository';

@Injectable()
export class PrismaInvestigationCaseRepository implements InvestigationCaseRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(c: InvestigationCase, act: AuditEventDraft): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.investigationCase.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          caseNumber: c.caseNumber,
          pvNumber: c.pvNumber,
          description: c.description,
          status: c.status,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        },
        update: {
          status: c.status,
          updatedAt: c.updatedAt,
        },
      });
      await this.auditTrail.append(act);
    });
  }

  async existsByCaseNumber(caseNumber: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.investigationCase.findUnique({
      where: { caseNumber },
      select: { id: true },
    });
    return found !== null;
  }
}
