import type { PixelTreatment } from '../../application/ports/report-image-embedder.port';

/**
 * Réplique des filtres de l'atelier (`canvasFilters.ts` du front). Les calculs
 * passent par un `Uint8ClampedArray`, comme l'`ImageData` d'un canvas : c'est
 * lui qui arrondit et écrête après chaque traitement, et deux traitements
 * enchaînés ne donnent pas le même pixel sans cet écrêtage intermédiaire.
 */

const RGBA = 4;
const CHANNELS_PER_PIXEL = 3;
const MID_LEVEL = 128;
const LEVELS = 256;
const MAX_LEVEL = 255;

const LUMA_RED = 0.299;
const LUMA_GREEN = 0.587;
const LUMA_BLUE = 0.114;

type Pixels = Uint8ClampedArray;

function scaleChannels(pixels: Pixels, factor: number): void {
  for (let offset = 0; offset < pixels.length; offset += RGBA) {
    pixels[offset] = pixels[offset] * factor;
    pixels[offset + 1] = pixels[offset + 1] * factor;
    pixels[offset + 2] = pixels[offset + 2] * factor;
  }
}

function applyContrast(pixels: Pixels, amount: number): void {
  const factor = 1 + amount;
  for (let offset = 0; offset < pixels.length; offset += RGBA) {
    for (let channel = 0; channel < CHANNELS_PER_PIXEL; channel += 1) {
      pixels[offset + channel] =
        (pixels[offset + channel] - MID_LEVEL) * factor + MID_LEVEL;
    }
  }
}

function applySaturation(pixels: Pixels, amount: number): void {
  const saturation = 1 + amount;
  for (let offset = 0; offset < pixels.length; offset += RGBA) {
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const grey = LUMA_RED * red + LUMA_GREEN * green + LUMA_BLUE * blue;
    pixels[offset] = grey + (red - grey) * saturation;
    pixels[offset + 1] = grey + (green - grey) * saturation;
    pixels[offset + 2] = grey + (blue - grey) * saturation;
  }
}

function applyInversion(pixels: Pixels): void {
  for (let offset = 0; offset < pixels.length; offset += RGBA) {
    for (let channel = 0; channel < CHANNELS_PER_PIXEL; channel += 1) {
      pixels[offset + channel] = MAX_LEVEL - pixels[offset + channel];
    }
  }
}

function applyChannels(
  pixels: Pixels,
  hidden: { red: boolean; green: boolean; blue: boolean },
): void {
  for (let offset = 0; offset < pixels.length; offset += RGBA) {
    if (hidden.red) pixels[offset] = 0;
    if (hidden.green) pixels[offset + 1] = 0;
    if (hidden.blue) pixels[offset + 2] = 0;
  }
}

function applyLevels(
  pixels: Pixels,
  points: { blackPoint: number; whitePoint: number; gamma: number },
): void {
  const black = points.blackPoint * MAX_LEVEL;
  const white = MAX_LEVEL - points.whitePoint * MAX_LEVEL;
  const span = white - black;
  if (span <= 0) {
    return;
  }

  const gamma = 2 ** -points.gamma;
  const remapped = new Uint8ClampedArray(LEVELS);
  for (let level = 0; level < LEVELS; level += 1) {
    const normalized = Math.min(1, Math.max(0, (level - black) / span));
    remapped[level] = MAX_LEVEL * normalized ** gamma;
  }

  for (let offset = 0; offset < pixels.length; offset += RGBA) {
    for (let channel = 0; channel < CHANNELS_PER_PIXEL; channel += 1) {
      pixels[offset + channel] = remapped[pixels[offset + channel]];
    }
  }
}

/**
 * Masque flou sur un voisinage de trois pixels sur trois. C'est le seul
 * traitement dont le résultat dépend de la résolution : à l'écran le voisinage
 * est celui du cache d'affichage, ici celui de la pièce scellée.
 */
function applySharpening(
  pixels: Pixels,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0) {
    return;
  }
  const source = new Uint8ClampedArray(pixels);
  const sampleAt = (x: number, y: number, channel: number): number => {
    const clampedX = Math.min(width - 1, Math.max(0, x));
    const clampedY = Math.min(height - 1, Math.max(0, y));
    return source[(clampedY * width + clampedX) * RGBA + channel];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = (y * width + x) * RGBA;
      for (let channel = 0; channel < CHANNELS_PER_PIXEL; channel += 1) {
        let neighbourhood = 0;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            neighbourhood += sampleAt(x + offsetX, y + offsetY, channel);
          }
        }
        const value = source[pixel + channel];
        pixels[pixel + channel] = value + amount * (value - neighbourhood / 9);
      }
    }
  }
}

export function applyPixelTreatments(
  pixels: Pixels,
  width: number,
  height: number,
  treatments: PixelTreatment[],
): void {
  for (const treatment of treatments) {
    switch (treatment.kind) {
      case 'BRIGHTNESS':
        scaleChannels(pixels, 1 + treatment.amount);
        break;
      case 'CONTRAST':
        applyContrast(pixels, treatment.amount);
        break;
      case 'SATURATION':
        applySaturation(pixels, treatment.amount);
        break;
      case 'INVERSION':
        applyInversion(pixels);
        break;
      case 'CHANNELS':
        applyChannels(pixels, treatment);
        break;
      case 'LEVELS':
        applyLevels(pixels, treatment);
        break;
      case 'SHARPENING':
        applySharpening(pixels, width, height, treatment.amount);
        break;
    }
  }
}
