import sharp, { type Sharp } from 'sharp';
import type { ImageGeometry } from '../../application/ports/report-image-embedder.port';
import { ImageSize } from './image-size';

export const PRINT_DPI = 300;

const MM_PER_INCH = 25.4;
const PLATE_WIDTH_MM = 178;
const PLATE_HEIGHT_MM = 150;

const MAX_WIDTH_PX = Math.round((PLATE_WIDTH_MM / MM_PER_INCH) * PRINT_DPI);
const MAX_HEIGHT_PX = Math.round((PLATE_HEIGHT_MM / MM_PER_INCH) * PRINT_DPI);

const SWAPS_AXES = 5;
const UPRIGHT = 1;

export interface PrintedImage {
  bytes: Buffer;
  width: number;
  height: number;
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

export function realSizeMm(
  displayed: ImageSize,
  resolutionDpi: number,
): ImageSize {
  return {
    width: (displayed.width / resolutionDpi) * MM_PER_INCH,
    height: (displayed.height / resolutionDpi) * MM_PER_INCH,
  };
}

/**
 * Dimensions telles que l'image s'affiche : l'orientation EXIF d'un appareil
 * tenu à la verticale échange les deux axes du fichier.
 */
export function displayedSize(
  stored: ImageSize,
  orientation: number | undefined,
): ImageSize {
  return (orientation ?? UPRIGHT) >= SWAPS_AXES
    ? { width: stored.height, height: stored.width }
    : stored;
}

/**
 * Encombrement de l'image une fois retournée : une rotation qui n'est pas un
 * quart de tour agrandit la toile jusqu'aux coins.
 */
export function geometrySize(
  displayed: ImageSize,
  geometry: ImageGeometry | null,
): ImageSize {
  if (geometry === null || geometry.rotationDeg === 0) {
    return displayed;
  }
  const radians = (geometry.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: Math.round(displayed.width * cos + displayed.height * sin),
    height: Math.round(displayed.width * sin + displayed.height * cos),
  };
}

/** L'atelier retourne avant de tourner : la reproduction compose dans le même ordre. */
function transformed(bytes: Buffer, geometry: ImageGeometry | null): Sharp {
  const oriented = sharp(bytes).rotate();
  if (geometry === null) {
    return oriented;
  }
  const flipped = geometry.mirrored ? oriented.flop() : oriented;
  return geometry.rotationDeg === 0
    ? flipped
    : flipped.rotate(geometry.rotationDeg, { background: '#ffffff' });
}

async function encode(
  bytes: Buffer,
  mimeType: string,
  target: ImageSize | null,
  geometry: ImageGeometry | null,
): Promise<Buffer | null> {
  const oriented = transformed(bytes, geometry);
  const pipeline = encodedAsSource(
    target === null
      ? oriented
      : oriented.resize({
          width: target.width,
          height: target.height,
          fit: 'inside',
          withoutEnlargement: true,
        }),
    mimeType,
  );
  return pipeline === null ? null : await pipeline.toBuffer();
}
export async function prepareForPlate(
  bytes: Buffer,
  mimeType: string,
  resolutionDpi: number | null,
  geometry: ImageGeometry | null,
): Promise<PrintedImage | null> {
  const { width, height, orientation } = await sharp(bytes).metadata();
  if (width === undefined || height === undefined) {
    return null;
  }
  const displayed = geometrySize(
    displayedSize({ width, height }, orientation),
    geometry,
  );

  if (resolutionDpi !== null) {
    const real = realSizeMm(displayed, resolutionDpi);
    if (real.width > PLATE_WIDTH_MM || real.height > PLATE_HEIGHT_MM) {
      return null;
    }
    const encoded = await encode(
      bytes,
      mimeType,
      {
        width: Math.max(1, Math.round((real.width / MM_PER_INCH) * PRINT_DPI)),
        height: Math.max(
          1,
          Math.round((real.height / MM_PER_INCH) * PRINT_DPI),
        ),
      },
      geometry,
    );
    return encoded === null
      ? null
      : {
          bytes: encoded,
          ...displayed,
          widthMm: real.width,
          heightMm: real.height,
        };
  }

  const fits =
    displayed.width <= MAX_WIDTH_PX && displayed.height <= MAX_HEIGHT_PX;
  const upright = (orientation ?? UPRIGHT) === UPRIGHT;
  if (fits && upright && geometry === null) {
    return null;
  }
  const encoded = await encode(
    bytes,
    mimeType,
    fits ? null : { width: MAX_WIDTH_PX, height: MAX_HEIGHT_PX },
    geometry,
  );
  return encoded === null
    ? null
    : { bytes: encoded, ...displayed, widthMm: null, heightMm: null };
}
