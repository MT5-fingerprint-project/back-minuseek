import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  AUDIT_TRAIL,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { Matching } from '../../domain/matching/entity/matching';
import type {
  MatchingRepository,
  MatchingWrite,
} from '../../domain/matching/repository/matching.repository';

@Injectable()
export class PrismaMatchingRepository implements MatchingRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async upsertMany(writes: MatchingWrite[]): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      for (const { matching, act } of writes) {
        const data = matching.toPrimitives();
        await prisma.matching.upsert({
          where: {
            traceId_referencePrintId: {
              traceId: data.traceId,
              referencePrintId: data.referencePrintId,
            },
          },
          create: data,
          update: { score: data.score, match: data.match },
        });
        await this.auditTrail.append(act);
      }
    });
  }

  async findByTraceId(traceId: string): Promise<Matching[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.matching.findMany({ where: { traceId } });
    return rows.map((row) => Matching.fromPrimitives(row));
  }
}
