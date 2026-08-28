import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { NOT_WITHDRAWN } from '../../../shared/infrastructure/persistence/withdrawal';
import { HitReadModel } from '../../application/queries/list-hits/hit-read-model';
import type { HitReader } from '../../application/queries/list-hits/hit.reader';

@Injectable()
export class PrismaHitReader implements HitReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByTraceId(traceId: string): Promise<HitReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    // Une identification suit ses deux pièces : retirer l'empreinte la fait
    // disparaître du comparateur, sans marquer la ligne `Hit` elle-même.
    return prisma.hit.findMany({
      where: {
        traceId,
        ...NOT_WITHDRAWN,
        trace: NOT_WITHDRAWN,
        referencePrint: NOT_WITHDRAWN,
      },
      select: { traceId: true, referencePrintId: true },
    });
  }
}
