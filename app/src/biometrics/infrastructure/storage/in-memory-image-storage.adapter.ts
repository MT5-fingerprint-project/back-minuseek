import { ImageStoragePort } from '../../application/ports/image-storage.port';

export class InMemoryImageStorageAdapter implements ImageStoragePort {
  private readonly files = new Map<string, Buffer>();

  save(buffer: Buffer, relativePath: string): Promise<string> {
    this.files.set(relativePath, buffer);
    return Promise.resolve(`media/${relativePath}`);
  }

  getSaved(relativePath: string): Buffer | undefined {
    return this.files.get(relativePath);
  }
}
