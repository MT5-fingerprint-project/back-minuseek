import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { ReportImageEmbedderPort } from '../../application/ports/report-image-embedder.port';
import {
  REPORT_STORAGE,
  type ReportStoragePort,
} from '../../application/ports/report-storage.port';
import { ReportImageViewModel } from '../../application/report-view-model';
import { readImageSize, type ImageSize } from './image-size';
import {
  resampleAtLifeSize,
  resampleForPrint,
  type PrintedImage,
} from './print-resampling';

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
    const size = readImageSize(bytes);
    const printed =
      size === null
        ? null
        : await this.printedCopy(
            bytes,
            size,
            mimeType,
            resolutionDpi,
            storedPath,
          );

    if (printed === null && resolutionDpi !== null) {
      return null;
    }

    return {
      // Les dimensions restent celles du fichier conservé : c'est le repère dans
      // lequel les minuties sont relevées, et la planche y étire la reproduction.
      dataUrl: `data:${mimeType};base64,${(printed?.bytes ?? bytes).toString('base64')}`,
      width: size?.width ?? null,
      height: size?.height ?? null,
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
    size: ImageSize,
    mimeType: string,
    resolutionDpi: number | null,
    storedPath: string,
  ): Promise<PrintedImage | null> {
    try {
      if (resolutionDpi !== null) {
        const lifeSize = await resampleAtLifeSize(
          bytes,
          size,
          mimeType,
          resolutionDpi,
        );
        if (lifeSize === null) {
          this.logger.warn(
            `Pièce non imprimée, sa taille réelle dépasse la planche: ${storedPath} (${resolutionDpi} dpi)`,
          );
        }
        return lifeSize;
      }
      const fitted = await resampleForPrint(bytes, size, mimeType);
      return fitted === null
        ? null
        : { bytes: fitted, widthMm: null, heightMm: null };
    } catch (error) {
      this.logger.warn(
        `Rééchantillonnage impossible: ${storedPath} (${String(error)})`,
      );
      return null;
    }
  }
}
