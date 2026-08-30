import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  CaseExpertiseReadModel,
  CaseUserReadModel,
  InvestigationCaseReadModel,
} from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import type {
  InvestigationCaseFilters,
  InvestigationCaseReader,
} from '../../application/queries/list-investigation-cases/investigation-case.reader';

interface InvestigationCaseRow {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  operatorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CaseExpertiseRow {
  caseId: string;
  expertUserId: string;
  courtReference: string;
  oathStatement: string;
  swornAt: Date;
}

@Injectable()
export class PrismaInvestigationCaseReader implements InvestigationCaseReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findAll(
    filters: InvestigationCaseFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.caseIds === null ? {} : { id: { in: filters.caseIds } }),
    };

    const [rows, total] = await Promise.all([
      prisma.investigationCase.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        // La liste est paginée et `createdAt` n'est pas unique : sans
        // départage, une affaire peut ressortir page 1 et page 2 à la fois.
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      prisma.investigationCase.count({ where }),
    ]);

    return { items: await this.withPeople(prisma, rows), total };
  }

  async findById(id: string): Promise<InvestigationCaseReadModel | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.investigationCase.findUnique({ where: { id } });
    if (!row) return null;

    const [item] = await this.withPeople(prisma, [row]);
    return item;
  }

  private async withPeople(
    prisma: PrismaClient,
    rows: InvestigationCaseRow[],
  ): Promise<InvestigationCaseReadModel[]> {
    const expertiseByCaseId = await this.expertisesOf(prisma, rows);
    const accountIds = [
      ...new Set(
        [
          ...rows.map((row) => row.operatorUserId),
          ...[...expertiseByCaseId.values()].map((row) => row.expertUserId),
        ].filter((userId): userId is string => userId !== null),
      ),
    ];

    const accountsById = new Map<string, CaseUserReadModel>();
    if (accountIds.length > 0) {
      const accounts = await prisma.user.findMany({
        where: { id: { in: accountIds } },
        select: {
          id: true,
          personalData: { select: { firstName: true, lastName: true } },
        },
      });
      for (const account of accounts) {
        accountsById.set(account.id, {
          id: account.id,
          firstName: account.personalData.firstName,
          lastName: account.personalData.lastName,
        });
      }
    }

    return rows.map((row) => ({
      id: row.id,
      caseNumber: row.caseNumber,
      pvNumber: row.pvNumber,
      description: row.description,
      status: row.status,
      operator: row.operatorUserId
        ? (accountsById.get(row.operatorUserId) ?? null)
        : null,
      expertise: expertiseOf(expertiseByCaseId.get(row.id), accountsById),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async expertisesOf(
    prisma: PrismaClient,
    rows: InvestigationCaseRow[],
  ): Promise<Map<string, CaseExpertiseRow>> {
    const declarations = await prisma.caseExpertise.findMany({
      where: { caseId: { in: rows.map((row) => row.id) } },
      select: {
        caseId: true,
        expertUserId: true,
        courtReference: true,
        oathStatement: true,
        swornAt: true,
      },
    });
    return new Map(
      declarations.map((declaration) => [declaration.caseId, declaration]),
    );
  }
}

function expertiseOf(
  row: CaseExpertiseRow | undefined,
  accountsById: Map<string, CaseUserReadModel>,
): CaseExpertiseReadModel | null {
  if (!row) return null;
  return {
    expert: accountsById.get(row.expertUserId) ?? null,
    courtReference: row.courtReference,
    oathStatement: row.oathStatement,
    swornAt: row.swornAt,
  };
}
