import { Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import { ImageStoragePort } from '../../application/ports/image-storage.port';

const MEDIA_PREFIX = 'media/';

function contentTypeFor(key: string): string {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Adapter de stockage GCS : uploads dans un bucket privé, lecture via URL signée
 * V4 keyless (signature IAM signBlob de l'identité runtime — pas de clé privée).
 * La clé stockée reste `media/<...>` (contrat identique aux autres adapters).
 */
@Injectable()
export class GcsImageStorageAdapter implements ImageStoragePort {
  private readonly storage = new Storage();
  private readonly urlCache = new Map<
    string,
    { url: string; expiresAtMs: number }
  >();
  private static readonly CACHE_MAX_ENTRIES = 1000;
  private static readonly REFRESH_MARGIN_MS = 60_000;

  constructor(
    private readonly bucketName: string,
    private readonly signedUrlTtlSeconds: number,
  ) {}

  async save(buffer: Buffer, relativePath: string): Promise<string> {
    const key = `${MEDIA_PREFIX}${relativePath.replace(/\\/g, '/')}`;
    await this.storage
      .bucket(this.bucketName)
      .file(key)
      .save(buffer, { contentType: contentTypeFor(key), resumable: false });
    return key;
  }

  async delete(storedPath: string): Promise<void> {
    await this.storage
      .bucket(this.bucketName)
      .file(storedPath)
      .delete({ ignoreNotFound: true });
  }

  async getUrl(storedPath: string): Promise<string> {
    const now = Date.now();
    const cached = this.urlCache.get(storedPath);
    if (
      cached &&
      cached.expiresAtMs - now > GcsImageStorageAdapter.REFRESH_MARGIN_MS
    ) {
      return cached.url;
    }

    const expiresAtMs = now + this.signedUrlTtlSeconds * 1000;
    const [url] = await this.storage
      .bucket(this.bucketName)
      .file(storedPath)
      .getSignedUrl({ version: 'v4', action: 'read', expires: expiresAtMs });

    this.cacheUrl(storedPath, { url, expiresAtMs });
    return url;
  }

  private cacheUrl(
    key: string,
    entry: { url: string; expiresAtMs: number },
  ): void {
    this.urlCache.delete(key);
    this.urlCache.set(key, entry);
    if (this.urlCache.size > GcsImageStorageAdapter.CACHE_MAX_ENTRIES) {
      // `oldestKey` est typé `string` (pas `any`) via l'itérateur des clés.
      for (const oldestKey of this.urlCache.keys()) {
        this.urlCache.delete(oldestKey);
        break;
      }
    }
  }
}
