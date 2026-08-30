import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { CaseVerificationReadModel } from '../../application/queries/list-case-verifications/case-verification-read-model';
import type { CaseVerificationReader } from '../../application/queries/list-case-verifications/case-verification.reader';
import { VerificationStatusEnum } from '../../domain/case-verification/value-objects/verification-status.vo';

interface CaseVerificationRow {
  id: string;
  caseId: string;
  verifierUserId: string;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
}

@Injectable()
export class PrismaCaseVerificationReader implements CaseVerificationReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(caseId: string): Promise<CaseVerificationReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.caseVerification.findMany({
      where: { caseId },
      orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
    });
    return this.withCasesAndVerifiers(prisma, rows);
  }

  async findForVerifier(
    verifierUserId: string,
  ): Promise<CaseVerificationReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.caseVerification.findMany({
      where: { verifierUserId },
      orderBy: [{ requestedAt: 'desc' }, { id: 'asc' }],
    });
    return this.withCasesAndVerifiers(prisma, rows);
  }

  private async withCasesAndVerifiers(
    prisma: PrismaClient,
    rows: CaseVerificationRow[],
  ): Promise<CaseVerificationReadModel[]> {
    if (rows.length === 0) return [];

    const [cases, accounts] = await Promise.all([
      prisma.investigationCase.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.caseId))] } },
        select: { id: true, caseNumber: true },
      }),
      prisma.user.findMany({
        where: {
          id: { in: [...new Set(rows.map((row) => row.verifierUserId))] },
        },
        select: {
          id: true,
          personalData: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const caseNumbersById = new Map(
      cases.map((investigationCase) => [
        investigationCase.id,
        investigationCase.caseNumber,
      ]),
    );
    const verifiersById = new Map(
      accounts.map((account) => [
        account.id,
        {
          firstName: account.personalData.firstName,
          lastName: account.personalData.lastName,
        },
      ]),
    );

    return rows.map((row) => ({
      id: row.id,
      caseId: row.caseId,
      caseNumber: caseNumbersById.get(row.caseId) ?? '',
      verifierUserId: row.verifierUserId,
      verifier: verifiersById.get(row.verifierUserId) ?? null,
      status: row.status as VerificationStatusEnum,
      requestedAt: row.requestedAt,
      completedAt: row.completedAt,
    }));
  }
}
