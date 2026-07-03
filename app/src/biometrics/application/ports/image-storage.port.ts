export interface ImageStoragePort {
  save(buffer: Buffer, relativePath: string): Promise<string>;
  delete(storedPath: string): Promise<void>;
  getUrl(storedPath: string): Promise<string>;
}

export const IMAGE_STORAGE = 'ImageStorage';
