import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import {
  ImageConverterPort,
  InvalidImageError,
} from '../../application/ports/image-converter.port';

@Injectable()
export class SharpImageConverterAdapter implements ImageConverterPort {
  async tiffToPng(tiff: Buffer): Promise<Buffer> {
    try {
      // L'encodage PNG est lossless : seul le format change, pas les pixels.
      return await sharp(tiff).png().toBuffer();
    } catch {
      throw new InvalidImageError();
    }
  }
}
