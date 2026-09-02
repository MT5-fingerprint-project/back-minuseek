import { Inject, Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  FingerPosition as PrismaFingerPosition,
  WithdrawalMotive as PrismaWithdrawalMotive,
} from '../../../../generated/prisma/enums';
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
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import type { ReferencePrintRepository } from '../../domain/reference-print/repository/reference-print.repository';

@Injectable()
export class PrismaReferencePrintRepository implements ReferencePrintRepository {
  constructor(
    private readonly tenantConnection: TenantConnectionService,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async save(rp: ReferencePrint, act: AuditEventDraft): Promise<AuditLink> {
    return this.transactionRunner.run(async () => {
      const prisma = await this.tenantConnection.getCurrentClient();
      const p = rp.toPrimitives();
      const data = {
        id: p.id,
        path: p.path,
        caseId: p.caseId,
        sha256: p.sha256,
        displayableSha256: p.displayableSha256 ?? null,
        subjectId: p.subjectId,
        position: p.position as PrismaFingerPosition | null,
        withdrawnAt: p.withdrawnAt,
        withdrawalMotive: p.withdrawalMotive as PrismaWithdrawalMotive | null,
        imageDestroyedAt: p.imageDestroyedAt,
        resolutionDpi: p.resolutionDpi,
        thumbPath: p.thumbPath,
      };
      await prisma.referencePrint.upsert({
        where: { id: data.id },
        create: data,
        update: data,
      });
      return this.auditTrail.append(act);
    });
  }

  async findById(id: string): Promise<ReferencePrint | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.referencePrint.findUnique({ where: { id } });
    return row ? ReferencePrint.reconstitute(row) : null;
  }
}
