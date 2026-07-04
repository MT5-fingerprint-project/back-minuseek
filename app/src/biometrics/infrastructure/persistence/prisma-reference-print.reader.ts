import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { ReferencePrintReadModel } from '../../application/queries/list-reference-prints/reference-print-read-model';
import type { ReferencePrintReader } from '../../application/queries/list-reference-prints/reference-print.reader';

@Injectable()
export class PrismaReferencePrintReader implements ReferencePrintReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(caseId: string): Promise<ReferencePrintReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.referencePrint.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
