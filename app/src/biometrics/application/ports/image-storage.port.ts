export interface ImageStoragePort {
  save(buffer: Buffer, relativePath: string): Promise<string>;
}

export const IMAGE_STORAGE = 'ImageStorage';
