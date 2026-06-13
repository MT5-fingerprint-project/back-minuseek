import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Layer } from '../../domain/layer/entity/layer';
import type { LayerRepository } from '../../domain/layer/repository/layer.repository';

@Injectable()
export class PrismaLayerRepository implements LayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(layer: Layer): Promise<void> {
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
    await this.prisma.layer.upsert({
      where: { id },
      create: { id, ...payload },
      update: payload,
    });
  }

  async findById(id: string): Promise<Layer | null> {
    const row = await this.prisma.layer.findUnique({ where: { id } });
    if (!row) return null;
    return Layer.reconstitute({
      ...row,
      type: row.type,
      settings: row.settings as Record<string, unknown>,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.layer.delete({ where: { id } });
  }
}
