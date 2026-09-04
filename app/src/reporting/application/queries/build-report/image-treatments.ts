import { PieceData } from '../../ports/case-report-data.reader';
import { ImageGeometry } from '../../ports/report-image-embedder.port';

const ROTATION = 'rotation';
const MIRROR = 'mirror';

interface Point {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

/**
 * Réglages de l'atelier qui déplacent les minuties. Les calques masqués sont
 * écartés : l'atelier ne les applique pas davantage à l'écran.
 */
export function geometryOf(piece: PieceData): ImageGeometry | null {
  let rotationDeg = 0;
  let mirrored = false;

  for (const layer of piece.layers) {
    if (layer.type !== 'FILTER' || !layer.isVisible) {
      continue;
    }
    const { filterKey, value } = layer.settings;
    if (typeof value !== 'number') {
      continue;
    }
    if (filterKey === ROTATION) {
      rotationDeg = value;
    }
    if (filterKey === MIRROR && value !== 0) {
      mirrored = true;
    }
  }

  return rotationDeg === 0 && !mirrored ? null : { rotationDeg, mirrored };
}

/**
 * Place une minutie sur la reproduction retravaillée. Le pixel d'indice `i`
 * occupe `[i, i+1[` : le calcul passe par son centre, sinon un retournement
 * décale tout d'un pixel.
 */
export function movedByGeometry(
  point: Point,
  geometry: ImageGeometry,
  source: Size,
  treated: Size,
): Point {
  const centred = { x: point.x + 0.5, y: point.y + 0.5 };
  const flipped = geometry.mirrored
    ? { x: source.width - centred.x, y: centred.y }
    : centred;

  const radians = (geometry.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const fromCentreX = flipped.x - source.width / 2;
  const fromCentreY = flipped.y - source.height / 2;

  return {
    x: fromCentreX * cos - fromCentreY * sin + treated.width / 2 - 0.5,
    y: fromCentreX * sin + fromCentreY * cos + treated.height / 2 - 0.5,
  };
}
