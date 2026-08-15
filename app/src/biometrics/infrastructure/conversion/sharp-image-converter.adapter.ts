import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ImageConverterPort } from '../../application/ports/image-converter.port';

@Injectable()
export class SharpImageConverterAdapter implements ImageConverterPort {
  async tiffToPng(tiff: Buffer): Promise<Buffer> {
    // L'encodage PNG est lossless : seul le format change, pas les pixels.
    return sharp(tiff).png().toBuffer();
  }
}
