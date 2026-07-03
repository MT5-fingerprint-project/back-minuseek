import { ImageStoragePort } from '../../application/ports/image-storage.port';

export class InMemoryImageStorageAdapter implements ImageStoragePort {
  private readonly files = new Map<string, Buffer>();

  save(buffer: Buffer, relativePath: string): Promise<string> {
    this.files.set(relativePath, buffer);
    return Promise.resolve(`media/${relativePath}`);
  }

  delete(storedPath: string): Promise<void> {
    this.files.delete(storedPath.replace(/^media\//, ''));
    return Promise.resolve();
  }

  getUrl(storedPath: string): Promise<string> {
    return Promise.resolve(`/${storedPath.replace(/^\/+/, '')}`);
  }

  getSaved(relativePath: string): Buffer | undefined {
    return this.files.get(relativePath);
  }
}
