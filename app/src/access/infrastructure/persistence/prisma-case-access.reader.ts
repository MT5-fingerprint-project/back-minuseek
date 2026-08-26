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

  /** Seul le titre d'opérateur se lit aujourd'hui : la mission de vérification,
   * et donc `CASE_VERIFIER`, arrive avec L8-1. */
  async findTitle(userId: string, caseId: string): Promise<CaseTitle | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const ownCase = await prisma.investigationCase.findFirst({
      where: { id: caseId, operatorUserId: userId },
      select: { id: true },
    });
    return ownCase ? 'CASE_OPERATOR' : null;
  }

  async findCaseIdsOf(userId: string): Promise<string[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const ownCases = await prisma.investigationCase.findMany({
      where: { operatorUserId: userId },
      select: { id: true },
    });
    return ownCases.map((ownCase) => ownCase.id);
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
