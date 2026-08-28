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
import { CaseExpertise } from '../../domain/case-expertise/entity/case-expertise';
import type { CaseExpertiseRepository } from '../../domain/case-expertise/repository/case-expertise.repository';

@Injectable()
export class PrismaCaseExpertiseRepository implements CaseExpertiseRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(
    expertise: CaseExpertise,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.caseExpertise.create({ data: expertise.toPrimitives() });
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }

  async existsForCase(caseId: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.caseExpertise.findUnique({
      where: { caseId },
      select: { id: true },
    });
    return found !== null;
  }
}
