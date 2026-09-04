import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { LayerSettings } from '../../domain/layer/entity/layer';
import { minutiaTypeOf } from '../../domain/layer/minutia';
import type {
  MinutiaPairReader,
  MinutiaPairRow,
} from '../../application/queries/list-minutia-pairs/minutia-pair.reader';

@Injectable()
export class PrismaMinutiaPairReader implements MinutiaPairReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByTraceAndReferencePrint(
    traceId: string,
    referencePrintId: string,
    authoredBy?: string | null,
  ): Promise<MinutiaPairRow[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.minutiaPair.findMany({
      where: {
        traceId,
        referencePrintId,
        // Le vérificateur en aveugle ne voit que les paires dont il a posé
        // les deux minuties : sans ce filtre, la correction ferait fuiter le
        // travail de l'opérateur.
        ...(authoredBy == null
          ? {}
          : {
              traceMinutia: { createdByUserId: authoredBy },
              referenceMinutia: { createdByUserId: authoredBy },
            }),
      },
      select: {
        id: true,
        createdAt: true,
        traceMinutiaLayerId: true,
        referenceMinutiaLayerId: true,
        traceMinutia: { select: { settings: true } },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      traceMinutiaLayerId: row.traceMinutiaLayerId,
      referenceMinutiaLayerId: row.referenceMinutiaLayerId,
      minutiaType: minutiaTypeOf(row.traceMinutia.settings as LayerSettings),
    }));
  }
}
