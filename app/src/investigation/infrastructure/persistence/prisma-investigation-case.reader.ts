import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import type { InvestigationCaseReader } from '../../application/queries/list-investigation-cases/investigation-case.reader';

@Injectable()
export class PrismaInvestigationCaseReader implements InvestigationCaseReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findAll(
    filters: { status?: InvestigationCaseStatusEnum; operatorId?: string },
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const where = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.investigationCase.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        // Tie-breaker sur id : createdAt n'est pas unique, sans lui la
        // pagination peut dupliquer/sauter des lignes entre deux pages.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
