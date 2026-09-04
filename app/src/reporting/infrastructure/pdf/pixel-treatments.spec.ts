import type { PixelTreatment } from '../../application/ports/report-image-embedder.port';
import { applyPixelTreatments } from './pixel-treatments';

/** Un seul pixel opaque, le strict nécessaire pour lire une formule. */
function pixel(red: number, green: number, blue: number): Uint8ClampedArray {
  return new Uint8ClampedArray([red, green, blue, 255]);
}

function treated(
  pixels: Uint8ClampedArray,
  treatments: PixelTreatment[],
  size: { width: number; height: number } = { width: 1, height: 1 },
): number[] {
  applyPixelTreatments(pixels, size.width, size.height, treatments);
  return [...pixels];
}

describe('applyPixelTreatments', () => {
  it('désature entièrement vers la luminance de l’atelier', () => {
    // 0,299×200 + 0,587×100 + 0,114×50 = 124,2 → 124 après écrêtage entier.
    expect(
      treated(pixel(200, 100, 50), [{ kind: 'SATURATION', amount: -1 }]),
    ).toEqual([124, 124, 124, 255]);
  });

  it('éclaircit en multipliant, et écrête à 255 sans replier', () => {
    expect(
      treated(pixel(200, 100, 50), [{ kind: 'BRIGHTNESS', amount: 0.5 }]),
    ).toEqual([255, 150, 75, 255]);
  });

  it('étire le contraste autour du gris moyen', () => {
    expect(
      treated(pixel(200, 128, 50), [{ kind: 'CONTRAST', amount: 0.5 }]),
    ).toEqual([236, 128, 11, 255]);
  });

  it('inverse chaque composante et laisse l’opacité', () => {
    expect(treated(pixel(200, 100, 50), [{ kind: 'INVERSION' }])).toEqual([
      55, 155, 205, 255,
    ]);
  });

  it('éteint les canaux masqués', () => {
    expect(
      treated(pixel(200, 100, 50), [
        { kind: 'CHANNELS', red: false, green: true, blue: true },
      ]),
    ).toEqual([200, 0, 0, 255]);
  });

  it('replace le point noir sur zéro', () => {
    expect(
      treated(pixel(51, 128, 255), [
        { kind: 'LEVELS', blackPoint: 0.2, whitePoint: 0, gamma: 0 },
      ]),
    ).toEqual([0, 96, 255, 255]);
  });

  it('ne touche à rien quand les points noir et blanc se croisent', () => {
    expect(
      treated(pixel(51, 128, 255), [
        { kind: 'LEVELS', blackPoint: 0.6, whitePoint: 0.6, gamma: 0 },
      ]),
    ).toEqual([51, 128, 255, 255]);
  });

  it('laisse un aplat intact au masque flou, faute de voisinage contrasté', () => {
    const flat = new Uint8ClampedArray(
      Array.from({ length: 9 }, () => [120, 120, 120, 255]).flat(),
    );

    expect(
      treated(flat, [{ kind: 'SHARPENING', amount: 0.15 }], {
        width: 3,
        height: 3,
      }).slice(0, 4),
    ).toEqual([120, 120, 120, 255]);
  });

  it('écrête entre deux traitements, comme le canevas : l’ordre change le pixel', () => {
    const brightThenContrast = treated(pixel(200, 100, 50), [
      { kind: 'BRIGHTNESS', amount: 0.5 },
      { kind: 'CONTRAST', amount: 0.5 },
    ]);
    const contrastThenBright = treated(pixel(200, 100, 50), [
      { kind: 'CONTRAST', amount: 0.5 },
      { kind: 'BRIGHTNESS', amount: 0.5 },
    ]);

    expect(brightThenContrast).not.toEqual(contrastThenBright);
    // 255 écrêté puis étiré reste 255 ; 236 éclairci l'aurait dépassé de loin.
    expect(brightThenContrast[0]).toBe(255);
    expect(contrastThenBright[0]).toBe(255);
    // 50 éclairci à 75 puis étiré donne 48,5 ; étiré d'abord à 11, il finit à 16,5.
    // Les deux s'arrondissent à l'entier pair, comme dans un `ImageData`.
    expect(brightThenContrast[2]).toBe(48);
    expect(contrastThenBright[2]).toBe(16);
  });
});
