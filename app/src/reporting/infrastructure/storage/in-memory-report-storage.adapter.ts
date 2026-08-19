import type { ReportStoragePort } from '../../application/ports/report-storage.port';

const MEDIA_PREFIX = 'media/';

export class InMemoryReportStorageAdapter implements ReportStoragePort {
  readonly files = new Map<string, Buffer>();

  save(pdf: Buffer, relativePath: string): Promise<string> {
    const storedPath = `${MEDIA_PREFIX}${relativePath}`;
    this.files.set(storedPath, pdf);
    return Promise.resolve(storedPath);
  }

  getUrl(storedPath: string): Promise<string> {
    return Promise.resolve(`in-memory://${storedPath}`);
  }

  read(storedPath: string): Promise<Buffer> {
    const file = this.files.get(storedPath);
    if (!file) {
      return Promise.reject(new Error(`Fichier absent: ${storedPath}`));
    }
    return Promise.resolve(file);
  }
}
