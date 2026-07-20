import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { CaseStatusPort } from '../../application/ports/case-status.port';

@Injectable()
export class PrismaCaseStatusAdapter implements CaseStatusPort {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findStatus(caseId: string): Promise<string | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.investigationCase.findUnique({
      where: { id: caseId },
      select: { status: true },
    });
    return row?.status ?? null;
  }
}
