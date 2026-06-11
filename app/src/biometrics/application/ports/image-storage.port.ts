export interface ImageStoragePort {
  save(buffer: Buffer, relativePath: string): Promise<string>;
  delete(storedPath: string): Promise<void>;
}

export const IMAGE_STORAGE = 'ImageStorage';
