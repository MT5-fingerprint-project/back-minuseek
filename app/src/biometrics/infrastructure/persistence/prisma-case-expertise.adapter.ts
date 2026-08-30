import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { CaseExpertisePort } from '../../application/ports/case-expertise.port';

@Injectable()
export class PrismaCaseExpertiseAdapter implements CaseExpertisePort {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async isUnderExpertise(caseId: string): Promise<boolean> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.caseExpertise.findUnique({
      where: { caseId },
      select: { id: true },
    });
    return row !== null;
  }
}
