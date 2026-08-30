import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { VerificationStatus } from '../../../../generated/prisma/enums';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { CaseVerification } from '../../domain/case-verification/entity/case-verification';
import type { CaseVerificationRepository } from '../../domain/case-verification/repository/case-verification.repository';

@Injectable()
export class PrismaCaseVerificationRepository implements CaseVerificationRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(
    verification: CaseVerification,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const primitives = verification.toPrimitives();
      const columns = {
        status: primitives.status as VerificationStatus,
        completedAt: primitives.completedAt,
      };
      await prisma.caseVerification.upsert({
        where: { id: primitives.id },
        create: {
          id: primitives.id,
          caseId: primitives.caseId,
          verifierUserId: primitives.verifierUserId,
          requestedByUserId: primitives.requestedByUserId,
          requestedAt: primitives.requestedAt,
          ...columns,
        },
        update: columns,
      });
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }

  async findById(id: string): Promise<CaseVerification | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.caseVerification.findUnique({ where: { id } });
    return row ? CaseVerification.reconstitute(row) : null;
  }

  async hasPendingFor(
    caseId: string,
    verifierUserId: string,
  ): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const pending = await prisma.caseVerification.findFirst({
      where: { caseId, verifierUserId, status: VerificationStatus.PENDING },
      select: { id: true },
    });
    return pending !== null;
  }
}
