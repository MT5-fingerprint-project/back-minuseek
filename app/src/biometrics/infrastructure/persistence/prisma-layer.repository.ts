import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { Layer } from '../../domain/layer/entity/layer';
import type { LayerSettings } from '../../domain/layer/entity/layer';
import { MINUTIA_SETTINGS_TYPES } from '../../domain/layer/minutia';
import type { LayerRepository } from '../../domain/layer/repository/layer.repository';

@Injectable()
export class PrismaLayerRepository implements LayerRepository {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async save(layer: Layer): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const { id, fingerprintId, name, type, zIndex, isVisible, settings } =
      layer.toPrimitives();
    const payload = {
      fingerprintId,
      name,
      type,
      zIndex,
      isVisible,
      settings,
    };
    await prisma.layer.upsert({
      where: { id },
      create: { id, ...payload },
      update: payload,
    });
  }

  async findById(id: string): Promise<Layer | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.layer.findUnique({ where: { id } });
    if (!row) return null;
    return Layer.reconstitute({
      ...row,
      type: row.type,
      settings: row.settings as LayerSettings,
    });
  }

  async delete(id: string): Promise<void> {
    const prisma = await this.tenantConnection.getCurrentClient();
    await prisma.layer.delete({ where: { id } });
  }

  async countMinutiae(fingerprintId: string): Promise<number> {
    const prisma = await this.tenantConnection.getCurrentClient();
    return prisma.layer.count({
      where: {
        fingerprintId,
        type: 'ANNOTATION',
        OR: MINUTIA_SETTINGS_TYPES.map((settingsType) => ({
          settings: { path: ['type'], equals: settingsType },
        })),
      },
    });
  }
}
