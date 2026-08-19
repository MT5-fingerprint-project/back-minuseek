import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditActorPrimitives } from '../../../shared/domain/audit/audit-actor.vo';
import type { CaseReportReadModel } from '../../application/queries/list-case-reports/case-report-read-model';
import type { CaseReportsReader } from '../../application/queries/list-case-reports/case-reports.reader';

@Injectable()
export class PrismaCaseReportsReader implements CaseReportsReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCase(caseId: string): Promise<CaseReportReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.report.findMany({
      where: { caseId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      sha256: row.sha256,
      createdAt: row.createdAt,
      generatedByDisplayName: (
        row.generatedBy as unknown as AuditActorPrimitives
      ).displayName,
    }));
  }
}
