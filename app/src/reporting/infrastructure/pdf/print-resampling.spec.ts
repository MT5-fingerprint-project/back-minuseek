import sharp from 'sharp';
import {
  realSizeMm,
  resampleAtLifeSize,
  resampleForPrint,
} from './print-resampling';

function gradient(width: number, height: number): Buffer {
  const pixels = Buffer.alloc(width * height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      pixels[row * width + column] = Math.floor((column * 255) / width);
    }
  }
  return pixels;
}

// L'encodage sharp est lent sous Jest : les pièces sont fabriquées une fois.
const OVERSIZED = { width: 2200, height: 1800 };
let png: Buffer;

beforeAll(async () => {
  png = await sharp(gradient(OVERSIZED.width, OVERSIZED.height), {
    raw: { ...OVERSIZED, channels: 1 },
  })
    .png()
    .toBuffer();
}, 60000);

describe('realSizeMm', () => {
  it('rend la taille réelle d’une trace calibrée', () => {
    const real = realSizeMm({ width: 4496, height: 3000 }, 3555);

    expect(real.width).toBeCloseTo(32.13, 1);
    expect(real.height).toBeCloseTo(21.44, 1);
  });

  it('rend une pièce plus grande quand la définition annoncée est plus basse', () => {
    const fine = realSizeMm({ width: 4496, height: 3000 }, 3555);
    const coarse = realSizeMm({ width: 4496, height: 3000 }, 1000);

    expect(coarse.width).toBeGreaterThan(fine.width);
  });
});

describe('resampleAtLifeSize', () => {
  it('rend la pièce à sa taille réelle, à la définition d’impression', async () => {
    const printed = await resampleAtLifeSize(png, OVERSIZED, 'image/png', 600);

    expect(printed?.widthMm).toBeCloseTo(93.13, 1);
    expect(printed?.heightMm).toBeCloseTo(76.2, 1);
    const metadata = await sharp(printed!.bytes).metadata();
    expect(metadata).toMatchObject({ width: 1100, height: 900 });
  });

  it('refuse la pièce qui dépasse la planche à l’échelle 1', async () => {
    await expect(
      resampleAtLifeSize(png, OVERSIZED, 'image/png', 300),
    ).resolves.toBeNull();
  });

  it('refuse un format que la planche ne sait pas afficher', async () => {
    await expect(
      resampleAtLifeSize(png, OVERSIZED, 'image/tiff', 600),
    ).resolves.toBeNull();
  });

  it('ne grossit pas une pièce moins définie que l’impression', async () => {
    const small = { width: 100, height: 80 };
    const bytes = await sharp(gradient(small.width, small.height), {
      raw: { ...small, channels: 1 },
    })
      .png()
      .toBuffer();

    const printed = await resampleAtLifeSize(bytes, small, 'image/png', 72);

    const metadata = await sharp(printed!.bytes).metadata();
    expect(metadata).toMatchObject(small);
  });
});

describe('resampleForPrint', () => {
  it('ajuste à la planche la pièce trop définie', async () => {
    const printed = await resampleForPrint(png, OVERSIZED, 'image/png');

    const metadata = await sharp(printed!).metadata();
    expect(metadata).toMatchObject({ width: 2102, height: 1720 });
  });

  it('laisse intacte la pièce qui tient déjà dans la planche', async () => {
    await expect(
      resampleForPrint(png, { width: 1200, height: 900 }, 'image/png'),
    ).resolves.toBeNull();
  });
});
