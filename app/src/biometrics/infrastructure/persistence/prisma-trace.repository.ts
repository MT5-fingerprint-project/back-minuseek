import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '../../../../generated/prisma/client';
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

  async save(trace: Trace, act: AuditEventDraft): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const { captureQuality, ...columns } = trace.toPrimitives();
      // `captureQuality` est un `Json?` : Prisma distingue l'absence de valeur
      // (`DbNull`, un NULL SQL) du littéral JSON `null`, et refuse un `null`
      // TypeScript qui ne dit pas lequel des deux on veut.
      const data = {
        ...columns,
        captureQuality:
          captureQuality === null
            ? Prisma.DbNull
            : (captureQuality as unknown as Prisma.InputJsonValue),
      };
      await prisma.trace.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
      await this.auditTrail.append(act);
    });
  }

  async findById(id: string): Promise<Trace | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.trace.findUnique({ where: { id } });
    return row ? Trace.reconstitute(row) : null;
  }

  async delete(id: string, act: AuditEventDraft): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.trace.delete({ where: { id } });
      await this.auditTrail.append(act);
    });
  }
}
