import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { InvalidImageError } from '../../application/ports/image-converter.port';
import { SharpImageConverterAdapter } from './sharp-image-converter.adapter';

const converter = new SharpImageConverterAdapter();

// Orientation EXIF 6 : l'appareil était tenu à la verticale, les pixels sont
// enregistrés couchés et seul le tag les remet debout.
const TILTED_EXIF_ORIENTATION = 6;

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

function pngFixture(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .png()
    .toBuffer();
}

function tiltedJpegFixture(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .withMetadata({ orientation: TILTED_EXIF_ORIENTATION })
    .jpeg()
    .toBuffer();
}

interface ThumbnailSources {
  landscape: Buffer;
  portrait: Buffer;
  squareOverBound: Buffer;
  squareOnBound: Buffer;
  underBound: Buffer;
  tilted: Buffer;
}

let sources: ThumbnailSources;

describe('SharpImageConverterAdapter — dimensions du fichier affiché', () => {
  it('lit les dimensions d’un PNG', async () => {
    const size = await converter.displayedSize(await pngFixture(800, 400));

    expect(size).toEqual({ width: 800, height: 400 });
  });

  it('échange les axes d’une photo couchée dont seul le tag EXIF la redresse', async () => {
    const size = await converter.displayedSize(
      await tiltedJpegFixture(800, 400),
    );

    expect(size).toEqual({ width: 400, height: 800 });
  });

  it('rend les dimensions de la vignette pour la même source, au ratio près', async () => {
    const tilted = await tiltedJpegFixture(800, 400);

    const [size, thumbnail] = await Promise.all([
      converter.displayedSize(tilted),
      converter.toDisplayThumbnail(tilted),
    ]);
    const metadata = await sharp(thumbnail).metadata();

    expect(size.width / size.height).toBeCloseTo(
      (metadata.width ?? 0) / (metadata.height ?? 1),
      5,
    );
  });

  it.each([
    [
      'un contenu qui n’est pas une image',
      Buffer.from('ceci n’est pas une image'),
    ],
    ['un buffer vide', Buffer.alloc(0)],
  ])('refuse %s', async (_label, bytes) => {
    await expect(converter.displayedSize(bytes)).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});

describe('SharpImageConverterAdapter — vignette d’affichage', () => {
  // Les pièces d'essai sont fabriquées une fois, aussi petites que la preuve le
  // permet : encoder des images occupe les workers Jest, et cette suite en
  // partage l'exécution avec toutes les autres. Seule la borne de 640 px impose
  // une taille — il faut la franchir dans un sens et rester dessous dans l'autre.
  beforeAll(async () => {
    sources = {
      landscape: await pngFixture(800, 400),
      portrait: await pngFixture(400, 800),
      squareOverBound: await pngFixture(700, 700),
      squareOnBound: await pngFixture(640, 640),
      underBound: await pngFixture(100, 80),
      tilted: await tiltedJpegFixture(800, 400),
    };
  });

  it('redresse une photo dont l’orientation ne vit que dans le tag EXIF', async () => {
    const thumbnail = await converter.toDisplayThumbnail(sources.tilted);

    const metadata = await sharp(thumbnail).metadata();
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(640);
  });

  it('rend un WebP', async () => {
    const thumbnail = await converter.toDisplayThumbnail(sources.landscape);

    expect(thumbnail.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(thumbnail.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });

  it.each<[string, keyof ThumbnailSources, number, number]>([
    ['paysage', 'landscape', 640, 320],
    ['portrait', 'portrait', 320, 640],
    ['carré au-delà de la borne', 'squareOverBound', 640, 640],
    ['carré exactement à la borne', 'squareOnBound', 640, 640],
  ])(
    'borne le grand côté à 640 px en gardant le ratio (%s)',
    async (_shape, source, expectedWidth, expectedHeight) => {
      const thumbnail = await converter.toDisplayThumbnail(sources[source]);

      const metadata = await sharp(thumbnail).metadata();
      expect(metadata.width).toBe(expectedWidth);
      expect(metadata.height).toBe(expectedHeight);
    },
  );

  it('n’agrandit jamais une image plus petite que la borne', async () => {
    const thumbnail = await converter.toDisplayThumbnail(sources.underBound);

    const metadata = await sharp(thumbnail).metadata();
    expect(metadata.width).toBe(100);
    expect(metadata.height).toBe(80);
  });

  it('allège l’image d’origine', async () => {
    const thumbnail = await converter.toDisplayThumbnail(sources.landscape);

    expect(thumbnail.length).toBeLessThan(sources.landscape.length);
  });

  it('laisse la source intacte', async () => {
    const untouched = Buffer.from(sources.landscape);

    await converter.toDisplayThumbnail(sources.landscape);

    expect(sources.landscape.equals(untouched)).toBe(true);
  });

  it('rend deux fois la même taille pour la même source', async () => {
    const first = await converter.toDisplayThumbnail(sources.landscape);
    const second = await converter.toDisplayThumbnail(sources.landscape);

    expect(first.length).toBe(second.length);
  });

  it.each([
    [
      'un contenu qui n’est pas une image',
      Buffer.from('ceci n’est pas une image'),
    ],
    ['un buffer vide', Buffer.alloc(0)],
    ['un en-tête PNG tronqué', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  ])('refuse %s', async (_label, bytes) => {
    await expect(converter.toDisplayThumbnail(bytes)).rejects.toBeInstanceOf(
      InvalidImageError,
    );
  });
});
