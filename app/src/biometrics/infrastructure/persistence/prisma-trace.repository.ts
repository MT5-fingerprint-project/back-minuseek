import { Inject, Injectable } from '@nestjs/common';
import { WithdrawalMotive as PrismaWithdrawalMotive } from '../../../../generated/prisma/enums';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { Trace } from '../../domain/trace/entity/trace';
import type { TraceRepository } from '../../domain/trace/repository/trace.repository';

@Injectable()
export class PrismaTraceRepository implements TraceRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(trace: Trace, act: AuditEventDraft): Promise<AuditLink> {
    return this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const { withdrawalMotive, ...columns } = trace.toPrimitives();
      const data = {
        ...columns,
        withdrawalMotive: withdrawalMotive as PrismaWithdrawalMotive | null,
      };
      await prisma.trace.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
      return this.auditTrail.append(act);
    });
  }

  async findById(id: string): Promise<Trace | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.trace.findUnique({ where: { id } });
    return row ? Trace.reconstitute(row) : null;
  }
}
