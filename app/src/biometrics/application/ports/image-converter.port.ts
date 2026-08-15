export interface ImageConverterPort {
  tiffToPng(tiff: Buffer): Promise<Buffer>;
}

export const IMAGE_CONVERTER = 'ImageConverter';
