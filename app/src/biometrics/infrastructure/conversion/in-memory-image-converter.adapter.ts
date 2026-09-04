import { ImageSize } from '../../domain/image-size';
import {
  ImageConverterPort,
  InvalidImageError,
} from '../../application/ports/image-converter.port';

/** Dimensions rendues par le double : arbitraires, mais paysage pour distinguer les axes. */
export const IN_MEMORY_DISPLAYED_SIZE: ImageSize = { width: 800, height: 600 };

export class InMemoryImageConverter implements ImageConverterPort {
  // Reproduit le contrat de l'adapter sharp : un contenu marqué "invalid"
  // est rejeté comme une image indécodable.
  tiffToPng(tiff: Buffer): Promise<Buffer> {
    if (tiff.toString().includes('invalid')) {
      return Promise.reject(new InvalidImageError());
    }
    return Promise.resolve(Buffer.concat([Buffer.from('png:'), tiff]));
  }

  displayedSize(source: Buffer): Promise<ImageSize> {
    if (source.toString().includes('invalid')) {
      return Promise.reject(new InvalidImageError());
    }
    return Promise.resolve(IN_MEMORY_DISPLAYED_SIZE);
  }

  toDisplayThumbnail(source: Buffer): Promise<Buffer> {
    if (source.toString().includes('invalid')) {
      return Promise.reject(new InvalidImageError());
    }
    return Promise.resolve(Buffer.concat([Buffer.from('thumb:'), source]));
  }
}
