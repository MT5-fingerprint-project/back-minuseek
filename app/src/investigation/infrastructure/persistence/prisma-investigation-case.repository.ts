import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import type { InvestigationCaseRepository } from '../../domain/investigation-case/repository/investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';

@Injectable()
export class PrismaInvestigationCaseRepository implements InvestigationCaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(c: InvestigationCase): Promise<void> {
    await this.prisma.investigationCase.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        caseNumber: c.caseNumber,
        pvNumber: c.pvNumber,
        description: c.description,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
      update: {
        status: c.status,
        updatedAt: c.updatedAt,
      },
    });
  }

  async existsByCaseNumber(caseNumber: string): Promise<boolean> {
    const found = await this.prisma.investigationCase.findUnique({
      where: { caseNumber },
      select: { id: true },
    });
    return found !== null;
  }

  async findAll(
    filters: { status?: InvestigationCaseStatusEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ cases: InvestigationCase[]; total: number }> {
    const where = filters.status ? { status: filters.status } : {};

    const [rows, total] = await Promise.all([
      this.prisma.investigationCase.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.investigationCase.count({ where }),
    ]);

    const cases = rows.map((r) =>
      InvestigationCase.reconstitute({
        id: r.id,
        caseNumber: r.caseNumber,
        pvNumber: r.pvNumber,
        description: r.description ?? undefined,
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );

    return { cases, total };
  }
}
