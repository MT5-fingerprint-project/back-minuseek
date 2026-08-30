import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { VerificationStatus } from '../../../../generated/prisma/enums';
import type {
  CaseAccessGrant,
  CaseAccessReader,
  CaseResourceKind,
} from '../../application/case-access.reader';

@Injectable()
export class PrismaCaseAccessReader implements CaseAccessReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findGrant(
    userId: string,
    caseId: string,
  ): Promise<CaseAccessGrant | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const ownCase = await prisma.investigationCase.findFirst({
      where: { id: caseId, operatorUserId: userId },
      select: { id: true },
    });
    if (ownCase) {
      return { title: 'CASE_OPERATOR', verificationInProgress: false };
    }

    const missions = await prisma.caseVerification.findMany({
      where: { caseId, verifierUserId: userId },
      select: { status: true },
    });
    if (missions.length === 0) return null;
    return {
      title: 'CASE_VERIFIER',
      verificationInProgress: missions.some(
        (mission) => mission.status === VerificationStatus.PENDING,
      ),
    };
  }

  async findCaseIdsOf(userId: string): Promise<string[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const [ownCases, missions] = await Promise.all([
      prisma.investigationCase.findMany({
        where: { operatorUserId: userId },
        select: { id: true },
      }),
      prisma.caseVerification.findMany({
        where: { verifierUserId: userId },
        select: { caseId: true },
      }),
    ]);
    return [
      ...new Set([
        ...ownCases.map((ownCase) => ownCase.id),
        ...missions.map((mission) => mission.caseId),
      ]),
    ];
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
