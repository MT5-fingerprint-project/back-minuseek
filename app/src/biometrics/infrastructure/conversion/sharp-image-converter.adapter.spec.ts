import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { InvalidImageError } from '../../application/ports/image-converter.port';
import { SharpImageConverterAdapter } from './sharp-image-converter.adapter';

const converter = new SharpImageConverterAdapter();

function digestOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function tiffFixture(): Promise<Buffer> {
  return sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .tiff()
    .toBuffer();
}

describe('SharpImageConverterAdapter', () => {
  it('rend un PNG à partir d’un TIFF', async () => {
    const png = await converter.tiffToPng(await tiffFixture());

    expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it('convertit deux fois le même TIFF en un PNG identique, à l’octet près', async () => {
    const tiff = await tiffFixture();

    const [first, second] = await Promise.all([
      converter.tiffToPng(tiff),
      converter.tiffToPng(tiff),
    ]);

    expect(digestOf(first)).toBe(digestOf(second));
  });

  it('rend des PNG différents pour deux TIFF différents', async () => {
    const [first, second] = await Promise.all([
      converter.tiffToPng(await tiffFixture()),
      converter.tiffToPng(
        await sharp({
          create: {
            width: 8,
            height: 8,
            channels: 3,
            background: { r: 200, g: 34, b: 56 },
          },
        })
          .tiff()
          .toBuffer(),
      ),
    ]);

    expect(digestOf(first)).not.toBe(digestOf(second));
  });

  it('refuse un contenu qui n’est pas une image', async () => {
    await expect(
      converter.tiffToPng(Buffer.from('ceci n’est pas une image')),
    ).rejects.toBeInstanceOf(InvalidImageError);
  });
});
