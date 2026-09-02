import sharp, { type Sharp } from 'sharp';
import { ImageSize } from './image-size';

export const PRINT_DPI = 300;

const MM_PER_INCH = 25.4;
// Boîte d'une planche : largeur imprimable de l'A4 (210 mm moins les marges
// latérales de 16 mm) et hauteur plafonnée par `.planche-image img`. Ces deux
// valeurs suivent la feuille de style : les changer là impose de les changer ici.
const PLATE_WIDTH_MM = 178;
const PLATE_HEIGHT_MM = 150;

const MAX_WIDTH_PX = Math.round((PLATE_WIDTH_MM / MM_PER_INCH) * PRINT_DPI);
const MAX_HEIGHT_PX = Math.round((PLATE_HEIGHT_MM / MM_PER_INCH) * PRINT_DPI);

export interface PrintedImage {
  bytes: Buffer;
  /** Taille d'impression imposée à la planche, en millimètres. */
  widthMm: number | null;
  heightMm: number | null;
}

function encodedAsSource(pipeline: Sharp, mimeType: string): Sharp | null {
  if (mimeType === 'image/png') {
    return pipeline.png();
  }
  if (mimeType === 'image/jpeg') {
    return pipeline.jpeg({ quality: 92 });
  }
  return null;
}

function resized(
  bytes: Buffer,
  mimeType: string,
  width: number,
  height: number,
): Promise<Buffer> | null {
  const pipeline = encodedAsSource(
    sharp(bytes).resize({
      width,
      height,
      fit: 'inside',
      withoutEnlargement: true,
    }),
    mimeType,
  );
  return pipeline === null ? null : pipeline.toBuffer();
}

export function realSizeMm(
  native: ImageSize,
  resolutionDpi: number,
): ImageSize {
  return {
    width: (native.width / resolutionDpi) * MM_PER_INCH,
    height: (native.height / resolutionDpi) * MM_PER_INCH,
  };
}

/**
 * Reproduction à l'échelle 1, à la définition d'impression : la planche impose
 * la taille réelle de la pièce en millimètres, calculée depuis sa calibration.
 * `null` quand la pièce dépasse la planche à cette échelle — on ne rogne pas une
 * trace et on ne l'imprime pas à une échelle qu'on ne peut pas annoncer.
 */
export async function resampleAtLifeSize(
  bytes: Buffer,
  native: ImageSize,
  mimeType: string,
  resolutionDpi: number,
): Promise<PrintedImage | null> {
  const real = realSizeMm(native, resolutionDpi);
  if (real.width > PLATE_WIDTH_MM || real.height > PLATE_HEIGHT_MM) {
    return null;
  }
  const target = {
    width: Math.max(1, Math.round((real.width / MM_PER_INCH) * PRINT_DPI)),
    height: Math.max(1, Math.round((real.height / MM_PER_INCH) * PRINT_DPI)),
  };
  const printed = resized(bytes, mimeType, target.width, target.height);
  if (printed === null) {
    return null;
  }
  return {
    bytes: await printed,
    widthMm: real.width,
    heightMm: real.height,
  };
}

/**
 * Reproduction ajustée à la planche, pour les pièces dont la taille réelle n'est
 * pas en jeu — la photo de localisation situe une scène, elle ne se mesure pas.
 * `null` quand l'image y tient déjà et que ses octets partent tels quels.
 */
export async function resampleForPrint(
  bytes: Buffer,
  native: ImageSize,
  mimeType: string,
): Promise<Buffer | null> {
  if (native.width <= MAX_WIDTH_PX && native.height <= MAX_HEIGHT_PX) {
    return null;
  }
  return await (resized(bytes, mimeType, MAX_WIDTH_PX, MAX_HEIGHT_PX) ?? null);
}
