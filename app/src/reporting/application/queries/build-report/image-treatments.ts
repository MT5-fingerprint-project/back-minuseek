import { PieceData } from '../../ports/case-report-data.reader';
import {
  ImageGeometry,
  ImageTreatment,
  PixelTreatment,
} from '../../ports/report-image-embedder.port';

const ROTATION = 'rotation';
const MIRROR = 'mirror';

/** Les trois canaux ne sont qu'un seul traitement dans l'atelier. Les trois niveaux aussi. */
const CHANNEL_KEYS: Record<string, 'red' | 'green' | 'blue'> = {
  channelRed: 'red',
  channelGreen: 'green',
  channelBlue: 'blue',
};

const LEVEL_KEYS: Record<string, 'blackPoint' | 'whitePoint' | 'gamma'> = {
  levelsBlack: 'blackPoint',
  levelsWhite: 'whitePoint',
  levelsGamma: 'gamma',
};

const SLIDER_SCALE = 100;

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
 * Réglages de l'atelier qui repeignent les pixels, dans l'ordre des calques :
 * c'est celui dans lequel le comparateur les empile, et deux traitements ne
 * commutent pas. Un curseur ramené à zéro n'a plus de calque, un calque masqué
 * n'est pas appliqué à l'écran, ni ici.
 */
export function pixelTreatmentsOf(piece: PieceData): PixelTreatment[] {
  const treatments: PixelTreatment[] = [];
  let channels: Extract<PixelTreatment, { kind: 'CHANNELS' }> | null = null;
  let levels: Extract<PixelTreatment, { kind: 'LEVELS' }> | null = null;

  for (const layer of piece.layers) {
    if (layer.type !== 'FILTER' || !layer.isVisible) {
      continue;
    }
    const { filterKey, value } = layer.settings;
    if (
      typeof filterKey !== 'string' ||
      typeof value !== 'number' ||
      value === 0
    ) {
      continue;
    }
    const amount = value / SLIDER_SCALE;

    // Les groupes prennent la place de leur première clé rencontrée et se
    // complètent ensuite : l'atelier n'applique leur filtre qu'une fois.
    const channel = CHANNEL_KEYS[filterKey];
    if (channel !== undefined) {
      if (channels === null) {
        channels = { kind: 'CHANNELS', red: false, green: false, blue: false };
        treatments.push(channels);
      }
      channels[channel] = true;
      continue;
    }

    const level = LEVEL_KEYS[filterKey];
    if (level !== undefined) {
      if (levels === null) {
        levels = { kind: 'LEVELS', blackPoint: 0, whitePoint: 0, gamma: 0 };
        treatments.push(levels);
      }
      levels[level] = amount;
      continue;
    }

    if (filterKey === 'brightness') {
      treatments.push({ kind: 'BRIGHTNESS', amount });
    } else if (filterKey === 'contrast') {
      treatments.push({ kind: 'CONTRAST', amount });
    } else if (filterKey === 'saturation') {
      treatments.push({ kind: 'SATURATION', amount });
    } else if (filterKey === 'inversion') {
      treatments.push({ kind: 'INVERSION' });
    } else if (filterKey === 'sharpening') {
      treatments.push({ kind: 'SHARPENING', amount });
    }
  }

  return treatments;
}

export function treatmentOf(piece: PieceData): ImageTreatment | null {
  const geometry = geometryOf(piece);
  const pixels = pixelTreatmentsOf(piece);
  return geometry === null && pixels.length === 0 ? null : { geometry, pixels };
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
