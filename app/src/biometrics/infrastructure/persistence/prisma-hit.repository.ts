import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { Hit } from '../../domain/hit/entity/hit';
import type { HitRepository } from '../../domain/hit/repository/hit.repository';

@Injectable()
export class PrismaHitRepository implements HitRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(hit: Hit): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const data = hit.toPrimitives();
    await prisma.hit.upsert({
      where: {
        traceId_referencePrintId: {
          traceId: data.traceId,
          referencePrintId: data.referencePrintId,
        },
      },
      create: data,
      update: { declaredByUserId: data.declaredByUserId },
    });
  }

  async deleteByPair(
    traceId: string,
    referencePrintId: string,
  ): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    await prisma.hit.deleteMany({ where: { traceId, referencePrintId } });
  }

  async findByTraceId(traceId: string): Promise<Hit[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.hit.findMany({ where: { traceId } });
    return rows.map((row) => Hit.fromPrimitives(row));
  }
}
