import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import {
  FINGERPRINT_LOCATOR,
  FingerprintLocatorPort,
} from '../../ports/fingerprint-locator.port';
import { ExportedImageView } from './exported-image-read-model';
import {
  EXPORTED_IMAGE_READER,
  ExportedImageReader,
} from './exported-image.reader';
import { ListExportedImagesQuery } from './list-exported-images.query';

@QueryHandler(ListExportedImagesQuery)
export class ListExportedImagesHandler implements IQueryHandler<ListExportedImagesQuery> {
  constructor(
    @Inject(FINGERPRINT_LOCATOR)
    private readonly locator: FingerprintLocatorPort,
    @Inject(EXPORTED_IMAGE_READER)
    private readonly reader: ExportedImageReader,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async execute(
    query: ListExportedImagesQuery,
  ): Promise<{ data: ExportedImageView[] }> {
    const location = await this.locator.locate(query.sourcePieceId);
    if (!location || location.caseId !== query.caseId) {
      return { data: [] };
    }

    const images = await this.reader.findBySourcePieceId(query.sourcePieceId);
    const data = await Promise.all(
      images.map(async ({ path, ...rest }) => ({
        ...rest,
        url: await this.storage.getUrl(path),
      })),
    );
    return { data };
  }
}
