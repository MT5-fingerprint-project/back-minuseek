import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  CaseOperatorReadModel,
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

    return { items: await this.withOperators(prisma, rows), total };
  }

  async findById(id: string): Promise<InvestigationCaseReadModel | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.investigationCase.findUnique({ where: { id } });
    if (!row) return null;

    const [item] = await this.withOperators(prisma, [row]);
    return item;
  }

  private async withOperators(
    prisma: PrismaClient,
    rows: InvestigationCaseRow[],
  ): Promise<InvestigationCaseReadModel[]> {
    const operatorIds = [
      ...new Set(
        rows
          .map((row) => row.operatorUserId)
          .filter((userId): userId is string => userId !== null),
      ),
    ];

    const operatorsById = new Map<string, CaseOperatorReadModel>();
    if (operatorIds.length > 0) {
      const accounts = await prisma.user.findMany({
        where: { id: { in: operatorIds } },
        select: {
          id: true,
          personalData: { select: { firstName: true, lastName: true } },
        },
      });
      for (const account of accounts) {
        operatorsById.set(account.id, {
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
        ? (operatorsById.get(row.operatorUserId) ?? null)
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
