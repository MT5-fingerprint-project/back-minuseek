/**
 * Copie conforme de `buildCurveLut` du comparateur
 * (`front-minuseek/src/features/biometric-image/lib/toneCurve.ts`) :
 * interpolation cubique monotone (Fritsch-Carlson) sur les 256 niveaux. Toute
 * retouche du calcul doit être portée des deux côtés, sinon la planche « après
 * traitements » ne montre plus ce que l'opérateur a vu.
 */

import { CurvePoint } from '../../application/ports/report-image-embedder.port';

const LEVELS = 256;
const MAX_LEVEL = 255;

function sortedCurvePoints(points: CurvePoint[]): CurvePoint[] {
  const byInput = new Map<number, number>();
  for (const point of points) {
    const input = Math.round(Math.min(MAX_LEVEL, Math.max(0, point.x)));
    const output = Math.round(Math.min(MAX_LEVEL, Math.max(0, point.y)));
    byInput.set(input, output);
  }
  return [...byInput.entries()]
    .sort(([left], [right]) => left - right)
    .map(([x, y]) => ({ x, y }));
}

export function buildCurveLut(points: CurvePoint[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(LEVELS);
  const knots = sortedCurvePoints(points);

  if (knots.length === 0) {
    for (let level = 0; level < LEVELS; level += 1) lut[level] = level;
    return lut;
  }
  if (knots.length === 1) {
    lut.fill(knots[0].y);
    return lut;
  }

  const count = knots.length;
  const slopes: number[] = [];
  for (let index = 0; index < count - 1; index += 1) {
    slopes.push(
      (knots[index + 1].y - knots[index].y) /
        (knots[index + 1].x - knots[index].x),
    );
  }

  const tangents: number[] = new Array<number>(count);
  tangents[0] = slopes[0];
  tangents[count - 1] = slopes[count - 2];
  for (let index = 1; index < count - 1; index += 1) {
    tangents[index] =
      slopes[index - 1] * slopes[index] <= 0
        ? 0
        : (slopes[index - 1] + slopes[index]) / 2;
  }
  for (let index = 0; index < count - 1; index += 1) {
    if (slopes[index] === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }
    const left = tangents[index] / slopes[index];
    const right = tangents[index + 1] / slopes[index];
    const norm = left * left + right * right;
    if (norm > 9) {
      const scale = 3 / Math.sqrt(norm);
      tangents[index] = scale * left * slopes[index];
      tangents[index + 1] = scale * right * slopes[index];
    }
  }

  let segment = 0;
  for (let level = 0; level < LEVELS; level += 1) {
    if (level <= knots[0].x) {
      lut[level] = knots[0].y;
      continue;
    }
    if (level >= knots[count - 1].x) {
      lut[level] = knots[count - 1].y;
      continue;
    }
    while (segment < count - 2 && level > knots[segment + 1].x) segment += 1;
    const span = knots[segment + 1].x - knots[segment].x;
    const ratio = (level - knots[segment].x) / span;
    const squared = ratio * ratio;
    const cubed = squared * ratio;
    lut[level] =
      knots[segment].y * (2 * cubed - 3 * squared + 1) +
      span * tangents[segment] * (cubed - 2 * squared + ratio) +
      knots[segment + 1].y * (-2 * cubed + 3 * squared) +
      span * tangents[segment + 1] * (cubed - squared);
  }

  return lut;
}
