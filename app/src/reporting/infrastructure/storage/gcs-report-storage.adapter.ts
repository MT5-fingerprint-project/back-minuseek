import { Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import type { ReportStoragePort } from '../../application/ports/report-storage.port';

const MEDIA_PREFIX = 'media/';
const PDF_CONTENT_TYPE = 'application/pdf';

/**
 * Même bucket privé que les pièces (ADR-0002), URL signée V4 keyless en lecture.
 * Pas de cache d'URL ici, contrairement aux images du comparateur : un rapport se
 * télécharge une fois, pas à chaque rendu de carousel.
 */
@Injectable()
export class GcsReportStorageAdapter implements ReportStoragePort {
  private readonly storage = new Storage();

  constructor(
    private readonly bucketName: string,
    private readonly signedUrlTtlSeconds: number,
  ) {}

  async save(pdf: Buffer, relativePath: string): Promise<string> {
    const storedPath = `${MEDIA_PREFIX}${relativePath}`;
    await this.storage
      .bucket(this.bucketName)
      .file(storedPath)
      .save(pdf, { contentType: PDF_CONTENT_TYPE, resumable: false });
    return storedPath;
  }

  async getUrl(storedPath: string): Promise<string> {
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(storedPath)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + this.signedUrlTtlSeconds * 1000,
      });
    return url;
  }

  async read(storedPath: string): Promise<Buffer> {
    const [bytes] = await this.storage
      .bucket(this.bucketName)
      .file(storedPath)
      .download();
    return bytes;
  }
}
