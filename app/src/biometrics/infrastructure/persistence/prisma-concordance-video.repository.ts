import { Inject, Injectable } from '@nestjs/common';
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
import { ConcordanceVideo } from '../../domain/concordance-video/entity/concordance-video';
import type { ConcordanceVideoRepository } from '../../domain/concordance-video/repository/concordance-video.repository';

@Injectable()
export class PrismaConcordanceVideoRepository implements ConcordanceVideoRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(
    video: ConcordanceVideo,
    act: AuditEventDraft,
  ): Promise<AuditLink> {
    return this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.concordanceVideo.create({ data: video.toPrimitives() });
      return this.auditTrail.append(act);
    });
  }

  async findByPair(
    traceId: string,
    referencePrintId: string,
  ): Promise<ConcordanceVideo[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.concordanceVideo.findMany({
      where: { traceId, referencePrintId },
      // `createdAt` seul n'est pas unique : l'identifiant ferme l'ordre.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ConcordanceVideo.reconstitute(row));
  }
}
