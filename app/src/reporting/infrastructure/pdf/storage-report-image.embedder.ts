import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ReportImageEmbedderPort } from '../../application/ports/report-image-embedder.port';
import {
  REPORT_STORAGE,
  type ReportStoragePort,
} from '../../application/ports/report-storage.port';
import { ReportImageViewModel } from '../../application/report-view-model';
import { readImageSize } from './image-size';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

function mimeTypeOf(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return MIME_TYPES[extension] ?? 'application/octet-stream';
}

@Injectable()
export class StorageReportImageEmbedder implements ReportImageEmbedderPort {
  private readonly logger = new Logger(StorageReportImageEmbedder.name);

  constructor(
    @Inject(REPORT_STORAGE)
    private readonly storage: ReportStoragePort,
  ) {}

  async embed(storedPath: string): Promise<ReportImageViewModel | null> {
    let bytes: Buffer;
    try {
      bytes = await this.storage.read(storedPath);
    } catch (error) {
      this.logger.warn(
        `Pièce illisible au rendu du rapport: ${storedPath} (${String(error)})`,
      );
      return null;
    }

    const size = readImageSize(bytes);
    return {
      dataUrl: `data:${mimeTypeOf(storedPath)};base64,${bytes.toString('base64')}`,
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  }
}
