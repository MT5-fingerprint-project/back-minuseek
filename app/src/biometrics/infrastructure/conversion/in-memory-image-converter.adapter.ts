import {
  ImageConverterPort,
  InvalidImageError,
} from '../../application/ports/image-converter.port';

export class InMemoryImageConverter implements ImageConverterPort {
  // Reproduit le contrat de l'adapter sharp : un contenu marqué "invalid"
  // est rejeté comme une image indécodable.
  tiffToPng(tiff: Buffer): Promise<Buffer> {
    if (tiff.toString().includes('invalid')) {
      return Promise.reject(new InvalidImageError());
    }
    return Promise.resolve(Buffer.concat([Buffer.from('png:'), tiff]));
  }
}
