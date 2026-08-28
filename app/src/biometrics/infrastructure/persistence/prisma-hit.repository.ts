import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { NOT_WITHDRAWN } from '../../../shared/infrastructure/persistence/withdrawal';
import {
  AUDIT_TRAIL,
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../shared/domain/ports/transaction-runner';
import { Hit } from '../../domain/hit/entity/hit';
import type { HitRepository } from '../../domain/hit/repository/hit.repository';

@Injectable()
export class PrismaHitRepository implements HitRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(hit: Hit, act: AuditEventDraft): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const data = hit.toPrimitives();
      await prisma.hit.upsert({
        where: {
          traceId_referencePrintId: {
            traceId: data.traceId,
            referencePrintId: data.referencePrintId,
          },
        },
        create: {
          id: data.id,
          traceId: data.traceId,
          referencePrintId: data.referencePrintId,
          declaredByUserId: data.declaredByUserId,
        },
        // Re-déclarer une identification retirée la remet au dossier : sans
        // cette ligne, l'upsert laisserait le marqueur en place sans erreur.
        update: { declaredByUserId: data.declaredByUserId, withdrawnAt: null },
      });
      await this.auditTrail.append(act);
    });
  }

  async withdrawByPair(
    traceId: string,
    referencePrintId: string,
    withdrawnAt: Date,
    act: AuditEventDraft,
  ): Promise<void> {
    await this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.hit.updateMany({
        where: { traceId, referencePrintId, ...NOT_WITHDRAWN },
        data: { withdrawnAt },
      });
      await this.auditTrail.append(act);
    });
  }

  async findByTraceId(traceId: string): Promise<Hit[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.hit.findMany({
      where: {
        traceId,
        ...NOT_WITHDRAWN,
        trace: NOT_WITHDRAWN,
        referencePrint: NOT_WITHDRAWN,
      },
    });
    return rows.map((row) => Hit.fromPrimitives(row));
  }
}
