import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type { LayerSettings } from '../../domain/layer/entity/layer';
import type { LayerReader } from '../../application/queries/list-layers/layer.reader';
import type { LayerReadModel } from '../../application/queries/list-layers/layer-read-model';

@Injectable()
export class PrismaLayerReader implements LayerReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByFingerprintId(fingerprintId: string): Promise<LayerReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.layer.findMany({
      where: { fingerprintId },
      orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      fingerprintId: row.fingerprintId,
      name: row.name,
      type: row.type,
      zIndex: row.zIndex,
      isVisible: row.isVisible,
      settings: row.settings as LayerSettings,
    }));
  }
}
