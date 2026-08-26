import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type {
  CaseAccessReader,
  CaseResourceKind,
  CaseTitle,
} from '../../application/case-access.reader';

@Injectable()
export class PrismaCaseAccessReader implements CaseAccessReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  findTitle(): Promise<CaseTitle | null> {
    return Promise.resolve(null);
  }

  findCaseIdsOf(): Promise<string[]> {
    return Promise.resolve([]);
  }

  async findCaseIdOfResource(
    kind: CaseResourceKind,
    resourceId: string,
  ): Promise<string | null> {
    const prisma = await this.tenantConnection.getCurrentClient();

    switch (kind) {
      case 'TRACE':
        return this.caseIdOfTrace(prisma, resourceId);
      case 'REFERENCE_PRINT':
        return this.caseIdOfReferencePrint(prisma, resourceId);
      case 'IMAGE':
        return this.caseIdOfImage(prisma, resourceId);
      case 'LAYER': {
        const layer = await prisma.layer.findUnique({
          where: { id: resourceId },
          select: { fingerprintId: true },
        });
        return layer ? this.caseIdOfImage(prisma, layer.fingerprintId) : null;
      }
      case 'SUBJECT': {
        const subject = await prisma.subject.findUnique({
          where: { id: resourceId },
          select: { caseId: true },
        });
        return subject?.caseId ?? null;
      }
      case 'REPORT': {
        const report = await prisma.report.findUnique({
          where: { id: resourceId },
          select: { caseId: true },
        });
        return report?.caseId ?? null;
      }
    }
  }

  private async caseIdOfImage(
    prisma: PrismaClient,
    fingerprintId: string,
  ): Promise<string | null> {
    return (
      (await this.caseIdOfTrace(prisma, fingerprintId)) ??
      (await this.caseIdOfReferencePrint(prisma, fingerprintId))
    );
  }

  private async caseIdOfTrace(
    prisma: PrismaClient,
    traceId: string,
  ): Promise<string | null> {
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
      select: { caseId: true },
    });
    return trace?.caseId ?? null;
  }

  private async caseIdOfReferencePrint(
    prisma: PrismaClient,
    referencePrintId: string,
  ): Promise<string | null> {
    const referencePrint = await prisma.referencePrint.findUnique({
      where: { id: referencePrintId },
      select: { caseId: true },
    });
    return referencePrint?.caseId ?? null;
  }
}
