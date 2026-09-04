import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ReportImageEmbedderPort } from '../../application/ports/report-image-embedder.port';
import type { ImageGeometry } from '../../application/ports/report-image-embedder.port';
import {
  REPORT_STORAGE,
  type ReportStoragePort,
} from '../../application/ports/report-storage.port';
import { ReportImageViewModel } from '../../application/report-view-model';
import { readImageSize } from './image-size';
import { prepareForPlate, type PrintedImage } from './print-resampling';

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

  async embed(
    storedPath: string,
    resolutionDpi: number | null,
    geometry: ImageGeometry | null,
  ): Promise<ReportImageViewModel | null> {
    let bytes: Buffer;
    try {
      bytes = await this.storage.read(storedPath);
    } catch (error) {
      this.logger.warn(
        `Pièce illisible au rendu du rapport: ${storedPath} (${String(error)})`,
      );
      return null;
    }

    const mimeType = mimeTypeOf(storedPath);
    const printed = await this.printedCopy(
      bytes,
      mimeType,
      resolutionDpi,
      storedPath,
      geometry,
    );
    if (printed === null && resolutionDpi !== null) {
      return null;
    }

    const stored = readImageSize(bytes);
    return {
      dataUrl: `data:${mimeType};base64,${(printed?.bytes ?? bytes).toString('base64')}`,
      // Dimensions de la reproduction embarquée, orientation comprise : c'est le
      // repère dans lequel la planche replace les minuties.
      width: printed?.width ?? stored?.width ?? null,
      height: printed?.height ?? stored?.height ?? null,
      // Empreinte du fichier conservé, jamais de la reproduction imprimée : c'est
      // elle que le chapitre intégrité confronte au registre.
      observedSha256: createHash('sha256').update(bytes).digest('hex'),
      lifeSizeMm:
        printed?.widthMm != null && printed.heightMm != null
          ? { width: printed.widthMm, height: printed.heightMm }
          : null,
    };
  }

  private async printedCopy(
    bytes: Buffer,
    mimeType: string,
    resolutionDpi: number | null,
    storedPath: string,
    geometry: ImageGeometry | null,
  ): Promise<PrintedImage | null> {
    try {
      const printed = await prepareForPlate(
        bytes,
        mimeType,
        resolutionDpi,
        geometry,
      );
      if (printed === null && resolutionDpi !== null) {
        this.logger.warn(
          `Pièce non imprimée, sa taille réelle dépasse la planche: ${storedPath} (${resolutionDpi} dpi)`,
        );
      }
      return printed;
    } catch (error) {
      this.logger.warn(
        `Rééchantillonnage impossible: ${storedPath} (${String(error)})`,
      );
      return null;
    }
  }
}
