import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { ReportStoragePort } from '../../application/ports/report-storage.port';
import { StorageReportImageEmbedder } from './storage-report-image.embedder';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const OVER_PLATE = { width: 2200, height: 1800 };
const FITS_PLATE = { width: 1200, height: 900 };

function storage(bytes: Buffer | Error): ReportStoragePort {
  return {
    save: () => Promise.resolve(''),
    getUrl: () => Promise.resolve(''),
    read: () =>
      bytes instanceof Error ? Promise.reject(bytes) : Promise.resolve(bytes),
  };
}

function gradient(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      pixels[row * width + column] = Math.floor((column * 255) / width);
    }
  }
  return pixels;
}

function grey(
  size: { width: number; height: number },
  format: 'png' | 'jpeg',
): Promise<Buffer> {
  const image = sharp(gradient(size.width, size.height), {
    raw: { ...size, channels: 1 },
  });
  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer();
}

function decoded(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

let overPlatePng: Buffer;
let overPlateJpeg: Buffer;
let fittingPng: Buffer;

beforeAll(async () => {
  [overPlatePng, overPlateJpeg, fittingPng] = await Promise.all([
    grey(OVER_PLATE, 'png'),
    grey(OVER_PLATE, 'jpeg'),
    grey(FITS_PLATE, 'png'),
  ]);
}, 60000);

describe('StorageReportImageEmbedder', () => {
  it('rend l’empreinte des octets qu’il vient de lire', async () => {
    const embedder = new StorageReportImageEmbedder(storage(PNG_1x1));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      null,
    );

    expect(image?.observedSha256).toBe(
      createHash('sha256').update(PNG_1x1).digest('hex'),
    );
  });

  it('lit aussi les dimensions natives, qui replacent les minuties', async () => {
    const embedder = new StorageReportImageEmbedder(storage(PNG_1x1));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      null,
    );

    expect(image).toMatchObject({ width: 1, height: 1 });
    expect(image?.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rend null sans jeter quand la pièce est illisible', async () => {
    const embedder = new StorageReportImageEmbedder(
      storage(new Error('stockage injoignable')),
    );

    await expect(
      embedder.embed('media/case-1/traces/trace-1.png', null, null),
    ).resolves.toBeNull();
  });

  it('rend l’empreinte même quand les dimensions natives sont illisibles', async () => {
    const bytes = Buffer.from('pas une image');
    const embedder = new StorageReportImageEmbedder(storage(bytes));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.tif',
      null,
      null,
    );

    expect(image?.width).toBeNull();
    expect(image?.observedSha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
  });

  it('ramène à la planche la pièce trop définie pour y tenir', async () => {
    const embedder = new StorageReportImageEmbedder(storage(overPlatePng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      null,
    );

    const printed = await sharp(decoded(image!.dataUrl)).metadata();
    expect(printed).toMatchObject({ width: 2102, height: 1720 });
  });

  it('redresse une pièce couchée par son orientation EXIF', async () => {
    const couchee = await sharp(gradient(2200, 1800), {
      raw: { width: 2200, height: 1800, channels: 1 },
    })
      .withMetadata({ orientation: 8 })
      .jpeg()
      .toBuffer();
    const embedder = new StorageReportImageEmbedder(storage(couchee));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.jpg',
      null,
      null,
    );

    expect(image).toMatchObject({ width: 1800, height: 2200 });
    const printed = await sharp(decoded(image!.dataUrl)).metadata();
    expect(printed.width).toBeLessThan(printed.height);
    expect(printed.orientation ?? 1).toBe(1);
  });

  it('laisse intacte la pièce qui tient déjà dans la planche', async () => {
    const embedder = new StorageReportImageEmbedder(storage(fittingPng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      null,
    );

    expect(decoded(image!.dataUrl).equals(fittingPng)).toBe(true);
  });

  it('garde le repère natif des minuties malgré la réduction', async () => {
    const embedder = new StorageReportImageEmbedder(storage(overPlatePng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      null,
    );

    expect(image).toMatchObject(OVER_PLATE);
  });

  it('rend null sur une pièce calibrée trop grande pour la planche', async () => {
    const embedder = new StorageReportImageEmbedder(storage(overPlatePng));

    await expect(
      embedder.embed('media/case-1/traces/trace-1.png', 300, null),
    ).resolves.toBeNull();
  });

  it('porte la taille imposée d’une pièce calibrée qui tient dans la planche', async () => {
    const embedder = new StorageReportImageEmbedder(storage(overPlatePng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      600,
      null,
    );

    expect(image!.lifeSizeMm!.width).toBeCloseTo(93.13, 1);
    expect(image!.lifeSizeMm!.height).toBeCloseTo(76.2, 1);
  });

  it('scelle le fichier conservé, pas la reproduction imprimée', async () => {
    const embedder = new StorageReportImageEmbedder(storage(overPlatePng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      null,
    );

    expect(image?.observedSha256).toBe(
      createHash('sha256').update(overPlatePng).digest('hex'),
    );
    expect(decoded(image!.dataUrl).equals(overPlatePng)).toBe(false);
  });

  it('réduit la pièce JPEG sans changer son format', async () => {
    const embedder = new StorageReportImageEmbedder(storage(overPlateJpeg));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.jpg',
      null,
      null,
    );

    const printed = await sharp(decoded(image!.dataUrl)).metadata();
    expect(printed).toMatchObject({ format: 'jpeg', width: 2102 });
  });
});

describe('StorageReportImageEmbedder — géométrie de l’atelier', () => {
  it('imprime la trace dans l’orientation que l’opérateur lui a donnée', async () => {
    const embedder = new StorageReportImageEmbedder(storage(fittingPng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      {
        rotationDeg: 90,
        mirrored: false,
      },
    );

    expect(image).toMatchObject({ width: 900, height: 1200 });
  });

  it('retourne l’image quand le miroir est enregistré', async () => {
    const embedder = new StorageReportImageEmbedder(storage(fittingPng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      {
        rotationDeg: 0,
        mirrored: true,
      },
    );

    const printed = await sharp(decoded(image!.dataUrl))
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Le dégradé va du noir à gauche au blanc à droite : retourné, il commence en clair.
    expect(printed.data[0]).toBeGreaterThan(200);
  });

  it('laisse la pièce intacte quand aucune géométrie n’est enregistrée', async () => {
    const embedder = new StorageReportImageEmbedder(storage(fittingPng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      null,
    );

    expect(decoded(image!.dataUrl).equals(fittingPng)).toBe(true);
  });

  it('scelle toujours l’empreinte du fichier conservé, jamais celle de la reproduction', async () => {
    const embedder = new StorageReportImageEmbedder(storage(fittingPng));

    const image = await embedder.embed(
      'media/case-1/traces/trace-1.png',
      null,
      {
        rotationDeg: 90,
        mirrored: false,
      },
    );

    expect(image?.observedSha256).toBe(
      createHash('sha256').update(fittingPng).digest('hex'),
    );
  });
});
