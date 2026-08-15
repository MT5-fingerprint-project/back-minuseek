import { ImageConverterPort } from '../../application/ports/image-converter.port';

export class InMemoryImageConverter implements ImageConverterPort {
  tiffToPng(tiff: Buffer): Promise<Buffer> {
    return Promise.resolve(Buffer.concat([Buffer.from('png:'), tiff]));
  }
}
