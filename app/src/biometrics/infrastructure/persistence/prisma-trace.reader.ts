import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { TraceReadModel } from '../../application/queries/list-traces/trace-read-model';
import type { TraceReader } from '../../application/queries/list-traces/trace.reader';

@Injectable()
export class PrismaTraceReader implements TraceReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCaseId(caseId: string): Promise<TraceReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.trace.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
