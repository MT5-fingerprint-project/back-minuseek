import sharp from 'sharp';
import { displayedSize, prepareForPlate, realSizeMm } from './print-resampling';

function gradient(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      pixels[row * width + column] = Math.floor((column * 255) / width);
    }
  }
  return pixels;
}

// Au-dessus de la planche (2102 × 1772 px) sur la largeur comme sur la hauteur.
const OVER_PLATE = { width: 2200, height: 1800 };
const FITS_PLATE = { width: 1200, height: 900 };

function jpeg(
  size: { width: number; height: number },
  orientation?: number,
): Promise<Buffer> {
  const image = sharp(gradient(size.width, size.height), {
    raw: { ...size, channels: 1 },
  });
  return (
    orientation === undefined ? image : image.withMetadata({ orientation })
  )
    .jpeg()
    .toBuffer();
}

// L'encodage sharp est lent sous Jest : les pièces sont fabriquées une fois.
let upright: Buffer;
let quarterTurn: Buffer;
let smallQuarterTurn: Buffer;
let coloured: Buffer;

/** Aplat orangé, assez petit pour tenir dans la planche sans rééchantillonnage. */
function orange(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 3] = 200;
    pixels[index * 3 + 1] = 100;
    pixels[index * 3 + 2] = 50;
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

beforeAll(async () => {
  [upright, quarterTurn, smallQuarterTurn, coloured] = await Promise.all([
    jpeg(OVER_PLATE),
    jpeg(OVER_PLATE, 8),
    jpeg(FITS_PLATE, 8),
    orange(8, 6),
  ]);
}, 60000);

describe('displayedSize', () => {
  it('échange les axes quand l’orientation EXIF couche le fichier', () => {
    expect(displayedSize({ width: 4496, height: 3000 }, 8)).toEqual({
      width: 3000,
      height: 4496,
    });
  });

  it('laisse les axes en place pour une image droite ou sans orientation', () => {
    const stored = { width: 4496, height: 3000 };

    expect(displayedSize(stored, 1)).toEqual(stored);
    expect(displayedSize(stored, undefined)).toEqual(stored);
  });
});

describe('realSizeMm', () => {
  it('rend la taille réelle d’une trace calibrée', () => {
    const real = realSizeMm({ width: 4496, height: 3000 }, 3555);

    expect(real.width).toBeCloseTo(32.13, 1);
    expect(real.height).toBeCloseTo(21.44, 1);
  });
});

describe('prepareForPlate — orientation', () => {
  it('redresse une photographie couchée par son orientation EXIF', async () => {
    const printed = await prepareForPlate(
      quarterTurn,
      'image/jpeg',
      null,
      null,
    );

    // 2200 × 1800 stocké, donc 1800 × 2200 debout.
    expect(printed).toMatchObject({ width: 1800, height: 2200 });
    const metadata = await sharp(printed!.bytes).metadata();
    expect(metadata.width).toBeLessThan(metadata.height);
  });

  it('cuit l’orientation dans les pixels plutôt que de laisser le tag', async () => {
    const printed = await prepareForPlate(
      quarterTurn,
      'image/jpeg',
      null,
      null,
    );

    const metadata = await sharp(printed!.bytes).metadata();
    expect(metadata.orientation ?? 1).toBe(1);
  });

  it('redresse aussi une photographie assez petite pour la planche', async () => {
    const printed = await prepareForPlate(
      smallQuarterTurn,
      'image/jpeg',
      null,
      null,
    );

    expect(printed).toMatchObject({
      width: FITS_PLATE.height,
      height: FITS_PLATE.width,
    });
  });

  it('laisse partir tels quels les octets d’une image droite qui tient déjà', async () => {
    const fitting = await jpeg(FITS_PLATE);

    await expect(
      prepareForPlate(fitting, 'image/jpeg', null, null),
    ).resolves.toBeNull();
  });
});

describe('prepareForPlate — échelle 1', () => {
  it('rend la pièce à sa taille réelle, à la définition d’impression', async () => {
    const printed = await prepareForPlate(upright, 'image/jpeg', 600, null);

    expect(printed?.widthMm).toBeCloseTo(93.13, 1);
    expect(printed?.heightMm).toBeCloseTo(76.2, 1);
    const metadata = await sharp(printed!.bytes).metadata();
    expect(metadata).toMatchObject({ width: 1100, height: 900 });
  });

  it('garde le repère natif des minuties malgré la réduction', async () => {
    const printed = await prepareForPlate(upright, 'image/jpeg', 600, null);

    expect(printed).toMatchObject(OVER_PLATE);
  });

  it('mesure la taille réelle sur l’image redressée, pas sur le fichier', async () => {
    const printed = await prepareForPlate(quarterTurn, 'image/jpeg', 600, null);

    // 1800 × 2200 affiché à 600 dpi : la pièce est plus haute que large.
    expect(printed!.widthMm).toBeCloseTo(76.2, 1);
    expect(printed!.heightMm).toBeCloseTo(93.13, 1);
  });

  it('refuse la pièce qui dépasse la planche à l’échelle 1', async () => {
    await expect(
      prepareForPlate(upright, 'image/jpeg', 300, null),
    ).resolves.toBeNull();
  });

  it('refuse un format que la planche ne sait pas afficher', async () => {
    await expect(
      prepareForPlate(upright, 'image/tiff', 600, null),
    ).resolves.toBeNull();
  });

  it('ne grossit pas une pièce moins définie que l’impression', async () => {
    const small = { width: 100, height: 80 };
    const bytes = await jpeg(small);

    const printed = await prepareForPlate(bytes, 'image/jpeg', 72, null);

    const metadata = await sharp(printed!.bytes).metadata();
    expect(metadata).toMatchObject(small);
  });
});

describe('prepareForPlate — ajustement à la planche', () => {
  it('ajuste la pièce trop définie', async () => {
    const printed = await prepareForPlate(upright, 'image/jpeg', null, null);

    const metadata = await sharp(printed!.bytes).metadata();
    expect(metadata).toMatchObject({ width: 2102, height: 1720 });
    expect(printed).toMatchObject(OVER_PLATE);
  });

  it('rend null sur un contenu qui n’est pas une image', async () => {
    await expect(
      prepareForPlate(Buffer.from('pas une image'), 'image/jpeg', null, null),
    ).rejects.toThrow();
  });
});

describe('prepareForPlate — traitements de l’atelier', () => {
  async function firstPixel(printed: Buffer): Promise<number[]> {
    const { data } = await sharp(printed)
      .raw()
      .toBuffer({ resolveWithObject: true });
    return [data[0], data[1], data[2]];
  }

  it('imprime la pièce repeinte, désaturée comme à l’écran', async () => {
    const printed = await prepareForPlate(coloured, 'image/png', null, {
      geometry: null,
      pixels: [{ kind: 'SATURATION', amount: -1 }],
    });

    expect(await firstPixel(printed!.bytes)).toEqual([124, 124, 124]);
  });

  it('reproduit la pièce même quand elle tenait déjà telle quelle dans la planche', async () => {
    await expect(
      prepareForPlate(coloured, 'image/png', null, null),
    ).resolves.toBeNull();

    await expect(
      prepareForPlate(coloured, 'image/png', null, {
        geometry: null,
        pixels: [{ kind: 'INVERSION' }],
      }),
    ).resolves.not.toBeNull();
  });

  it('repeint sans déplacer un pixel : les minuties gardent leur place', async () => {
    const printed = await prepareForPlate(coloured, 'image/png', null, {
      geometry: null,
      pixels: [{ kind: 'SATURATION', amount: -1 }],
    });

    expect(printed).toMatchObject({ width: 8, height: 6 });
  });

  it('compose la géométrie par-dessus la pièce repeinte', async () => {
    const printed = await prepareForPlate(coloured, 'image/png', null, {
      geometry: { rotationDeg: 90, mirrored: false },
      pixels: [{ kind: 'SATURATION', amount: -1 }],
    });

    expect(printed).toMatchObject({ width: 6, height: 8 });
    expect(await firstPixel(printed!.bytes)).toEqual([124, 124, 124]);
  });

  it('repeint avant de tourner : le fond ajouté par la rotation reste blanc', async () => {
    const printed = await prepareForPlate(coloured, 'image/png', null, {
      geometry: { rotationDeg: 45, mirrored: false },
      pixels: [{ kind: 'INVERSION' }],
    });

    // Tourner d'abord puis inverser noircirait ce coin, que la rotation a peint en blanc.
    expect(await firstPixel(printed!.bytes)).toEqual([255, 255, 255]);
  });
});
