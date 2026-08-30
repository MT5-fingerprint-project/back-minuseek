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
import { ExportedImage } from '../../domain/exported-image/entity/exported-image';
import type { ExportedImageRepository } from '../../domain/exported-image/repository/exported-image.repository';

@Injectable()
export class PrismaExportedImageRepository implements ExportedImageRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(image: ExportedImage, act: AuditEventDraft): Promise<AuditLink> {
    return this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      await prisma.exportedImage.create({ data: image.toPrimitives() });
      return this.auditTrail.append(act);
    });
  }

  async findBySourcePieceId(sourcePieceId: string): Promise<ExportedImage[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.exportedImage.findMany({
      where: { sourcePieceId },
      // `createdAt` seul n'est pas unique : l'identifiant ferme l'ordre.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => ExportedImage.reconstitute(row));
  }
}
