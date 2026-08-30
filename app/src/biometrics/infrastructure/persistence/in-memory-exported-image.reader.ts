import { ExportedImageReadModel } from '../../application/queries/list-exported-images/exported-image-read-model';
import { ExportedImageReader } from '../../application/queries/list-exported-images/exported-image.reader';

export class InMemoryExportedImageReader implements ExportedImageReader {
  private readonly rows: ExportedImageReadModel[] = [];

  seed(row: ExportedImageReadModel): void {
    this.rows.push(row);
  }

  findBySourcePieceId(
    sourcePieceId: string,
  ): Promise<ExportedImageReadModel[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.sourcePieceId === sourcePieceId)
        // Imite le tri Prisma (`createdAt`, puis `id` en départage).
        .sort((a, b) => {
          const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
          return byCreatedAt !== 0 ? byCreatedAt : a.id.localeCompare(b.id);
        }),
    );
  }
}
