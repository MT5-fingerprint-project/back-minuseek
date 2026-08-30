import { Inject, Injectable } from '@nestjs/common';
import {
  DecisionOutcome,
  VerificationExploitability,
} from '../../../../generated/prisma/enums';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { VerificationDecision } from '../../domain/case-verification/entity/verification-decision';
import { DecisionOutcomeEnum } from '../../domain/case-verification/value-objects/decision-outcome.vo';
import type { VerificationDecisionRepository } from '../../domain/case-verification/repository/verification-decision.repository';

@Injectable()
export class PrismaVerificationDecisionRepository implements VerificationDecisionRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async findByVerificationId(
    verificationId: string,
  ): Promise<VerificationDecision[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.verificationDecision.findMany({
      where: { verificationId },
      orderBy: [{ statedAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) =>
      VerificationDecision.reconstitute({
        ...row,
        outcome: row.outcome as DecisionOutcomeEnum | null,
      }),
    );
  }

  async save(
    decision: VerificationDecision,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      await this.upsert(decision);
      for (const act of acts) {
        await this.auditTrail.append(act);
      }
    });
  }

  async saveAll(decisions: VerificationDecision[]): Promise<void> {
    await this.transactionRunner.run(async () => {
      for (const decision of decisions) {
        await this.upsert(decision);
      }
    });
  }

  private async upsert(decision: VerificationDecision): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const primitives = decision.toPrimitives();
    const columns = {
      exploitability: primitives.exploitability as VerificationExploitability,
      identifiedReferencePrintId: primitives.identifiedReferencePrintId,
      outcome: primitives.outcome as DecisionOutcome | null,
      statedAt: primitives.statedAt,
    };
    await prisma.verificationDecision.upsert({
      where: { id: primitives.id },
      create: {
        id: primitives.id,
        verificationId: primitives.verificationId,
        traceId: primitives.traceId,
        ...columns,
      },
      update: columns,
    });
  }
}
