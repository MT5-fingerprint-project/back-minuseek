import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditActorPrimitives } from '../../../shared/domain/audit/audit-actor.vo';
import { Report, ReportTypeName } from '../../domain/report/entity/report';
import type { ReportRepository } from '../../domain/report/repository/report.repository';

interface ReportRow {
  id: string;
  caseId: string;
  type: string;
  storagePath: string;
  sha256: string;
  generatedBy: unknown;
  createdAt: Date;
}

function toReport(row: ReportRow): Report {
  return Report.reconstitute({
    id: row.id,
    caseId: row.caseId,
    type: row.type as ReportTypeName,
    storagePath: row.storagePath,
    sha256: row.sha256,
    generatedBy: row.generatedBy as AuditActorPrimitives,
    createdAt: row.createdAt,
  });
}

@Injectable()
export class PrismaReportRepository implements ReportRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(report: Report): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const primitives = report.toPrimitives();
    await prisma.report.create({
      data: {
        id: primitives.id,
        caseId: primitives.caseId,
        type: primitives.type,
        storagePath: primitives.storagePath,
        sha256: primitives.sha256,
        generatedBy: primitives.generatedBy as unknown as Prisma.InputJsonValue,
        createdAt: primitives.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Report | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.report.findUnique({ where: { id } });
    return row ? toReport(row) : null;
  }
}
