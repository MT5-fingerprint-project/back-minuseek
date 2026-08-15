export class InvalidImageError extends Error {
  constructor() {
    super('Image illisible : impossible de la décoder pour la conversion');
  }
}

export interface ImageConverterPort {
  /** @throws InvalidImageError si le buffer n'est pas une image décodable */
  tiffToPng(tiff: Buffer): Promise<Buffer>;
}

export const IMAGE_CONVERTER = 'ImageConverter';
