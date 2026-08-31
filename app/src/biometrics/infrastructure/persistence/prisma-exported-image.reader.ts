import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { ExportedImageReadModel } from '../../application/queries/list-exported-images/exported-image-read-model';
import type { ExportedImageReader } from '../../application/queries/list-exported-images/exported-image.reader';

@Injectable()
export class PrismaExportedImageReader implements ExportedImageReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findBySourcePieceId(
    sourcePieceId: string,
  ): Promise<ExportedImageReadModel[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.exportedImage.findMany({
      where: { sourcePieceId },
      // `createdAt` seul n'est pas unique : l'identifiant ferme l'ordre.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        sourcePieceId: true,
        sourceKind: true,
        path: true,
        sha256: true,
        createdAt: true,
      },
    });
    return rows;
  }
}
