import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { ReportTypeName } from '../../domain/report/entity/report';
import type {
  ReportNumberingData,
  ReportNumberingReader,
} from '../../application/ports/report-numbering.reader';

@Injectable()
export class PrismaReportNumberingReader implements ReportNumberingReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async read(
    caseId: string,
    type: ReportTypeName,
  ): Promise<ReportNumberingData> {
    const prisma = await this.tenantConnection.getCurrentClient();

    const [highest, previous] = await Promise.all([
      prisma.report.findFirst({
        where: { caseId },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      }),
      prisma.report.findFirst({
        where: { caseId, type },
        orderBy: { sequence: 'desc' },
        select: { number: true, createdAt: true },
      }),
    ]);

    return {
      lastSequence: highest?.sequence ?? 0,
      previousOfType: previous
        ? { number: previous.number, issuedAt: previous.createdAt }
        : null,
    };
  }
}
