import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { HitReadModel } from '../../application/queries/list-hits/hit-read-model';
import type { HitReader } from '../../application/queries/list-hits/hit.reader';

@Injectable()
export class PrismaHitReader implements HitReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByTraceId(traceId: string): Promise<HitReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.hit.findMany({
      where: { traceId },
      select: { traceId: true, referencePrintId: true },
    });
  }
}
