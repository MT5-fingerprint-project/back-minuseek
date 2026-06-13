import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LayerReader } from '../../application/queries/list-layers/layer.reader';
import type { LayerReadModel } from '../../application/queries/list-layers/layer-read-model';

@Injectable()
export class PrismaLayerReader implements LayerReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByFingerprintId(fingerprintId: string): Promise<LayerReadModel[]> {
    const rows = await this.prisma.layer.findMany({
      where: { fingerprintId },
      orderBy: { zIndex: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      fingerprintId: row.fingerprintId,
      name: row.name,
      type: row.type,
      zIndex: row.zIndex,
      isVisible: row.isVisible,
      settings: row.settings as Record<string, unknown>,
    }));
  }
}
