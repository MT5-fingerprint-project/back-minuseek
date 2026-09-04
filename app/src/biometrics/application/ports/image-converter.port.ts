import { ImageSize } from '../../domain/image-size';

export class InvalidImageError extends Error {
  constructor() {
    super('Image illisible : impossible de la décoder pour la conversion');
  }
}

export interface ImageConverterPort {
  /** @throws InvalidImageError si le buffer n'est pas une image décodable */
  tiffToPng(tiff: Buffer): Promise<Buffer>;

  /**
   * Dimensions du fichier tel qu'il s'affiche, orientation EXIF appliquée.
   * @throws InvalidImageError si le buffer n'est pas une image décodable
   */
  displayedSize(source: Buffer): Promise<ImageSize>;

  /**
   * Variante réduite servie à l'affichage, jamais au canevas de comparaison.
   * @throws InvalidImageError si le buffer n'est pas une image décodable
   */
  toDisplayThumbnail(source: Buffer): Promise<Buffer>;
}

export const IMAGE_CONVERTER = 'ImageConverter';
