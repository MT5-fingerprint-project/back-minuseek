import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  NOT_WITHDRAWN,
  WITHDRAWN_ONLY,
} from '../../../shared/infrastructure/persistence/withdrawal';
import { ReferencePrintReadModel } from '../../application/queries/list-reference-prints/reference-print-read-model';
import type { ReferencePrintReader } from '../../application/queries/list-reference-prints/reference-print.reader';

@Injectable()
export class PrismaReferencePrintReader implements ReferencePrintReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(
    caseId: string,
    withdrawn = false,
  ): Promise<ReferencePrintReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.referencePrint.findMany({
      where: { caseId, ...(withdrawn ? WITHDRAWN_ONLY : NOT_WITHDRAWN) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: {
        matchings: {
          select: { traceId: true, score: true, match: true },
        },
      },
    });
  }
}
