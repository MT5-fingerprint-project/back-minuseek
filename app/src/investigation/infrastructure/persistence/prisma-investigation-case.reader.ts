import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import type { InvestigationCaseReader } from '../../application/queries/list-investigation-cases/investigation-case.reader';

@Injectable()
export class PrismaInvestigationCaseReader implements InvestigationCaseReader {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: { status?: InvestigationCaseStatusEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }> {
    const where = filters.status ? { status: filters.status } : {};

    const [items, total] = await Promise.all([
      this.prisma.investigationCase.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.investigationCase.count({ where }),
    ]);

    return { items, total };
  }
}
