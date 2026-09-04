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
import { MinutiaPair } from '../../domain/minutia-pair/entity/minutia-pair';
import { MinutiaPairAlreadyExistsError } from '../../domain/minutia-pair/errors/minutia-pair-already-exists.error';
import type { MinutiaPairRepository } from '../../domain/minutia-pair/repository/minutia-pair.repository';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

@Injectable()
export class PrismaMinutiaPairRepository implements MinutiaPairRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(pair: MinutiaPair, act: AuditEventDraft): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      try {
        await prisma.minutiaPair.create({ data: pair.toPrimitives() });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new MinutiaPairAlreadyExistsError();
        }
        throw error;
      }
      await this.auditTrail.append(act);
    });
  }

  async findById(id: string): Promise<MinutiaPair | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.minutiaPair.findUnique({ where: { id } });
    return row === null ? null : MinutiaPair.fromPrimitives(row);
  }

  async delete(id: string, act: AuditEventDraft): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.minutiaPair.delete({ where: { id } });
      await this.auditTrail.append(act);
    });
  }

  async findByMinutiaLayerId(layerId: string): Promise<MinutiaPair[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.minutiaPair.findMany({
      where: {
        OR: [
          { traceMinutiaLayerId: layerId },
          { referenceMinutiaLayerId: layerId },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => MinutiaPair.fromPrimitives(row));
  }
}
