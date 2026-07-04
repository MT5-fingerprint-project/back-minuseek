import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import type { InvestigationCaseRepository } from '../../domain/investigation-case/repository/investigation-case.repository';

@Injectable()
export class PrismaInvestigationCaseRepository implements InvestigationCaseRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(c: InvestigationCase): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    await prisma.investigationCase.upsert({
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
    const prisma = await this.tenantConnection.getCurrentClient();
    const found = await prisma.investigationCase.findUnique({
      where: { caseNumber },
      select: { id: true },
    });
    return found !== null;
  }
}
