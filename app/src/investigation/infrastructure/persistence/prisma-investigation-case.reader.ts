import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import type { InvestigationCaseReader } from '../../application/queries/list-investigation-cases/investigation-case.reader';

@Injectable()
export class PrismaInvestigationCaseReader implements InvestigationCaseReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findAll(
    filters: { status?: InvestigationCaseStatusEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const where = filters.status ? { status: filters.status } : {};

    const [items, total] = await Promise.all([
      prisma.investigationCase.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.investigationCase.count({ where }),
    ]);

    return { items, total };
  }

  async findById(id: string): Promise<InvestigationCaseReadModel | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.investigationCase.findUnique({ where: { id } });
  }
}
