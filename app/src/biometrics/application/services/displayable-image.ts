import { createHash } from 'node:crypto';
import { ImageSize } from '../../domain/image-size';
import { ImageConverterPort } from '../ports/image-converter.port';
import { ImageStoragePort } from '../ports/image-storage.port';

export class UnsupportedImageFormatError extends Error {
  constructor() {
    super("Format d'image non supporté : PNG, JPEG ou TIFF attendu");
  }
}

const SIGNATURES: ReadonlyArray<[Buffer, '.png' | '.jpg' | '.tif']> = [
  [Buffer.from([0x89, 0x50, 0x4e, 0x47]), '.png'],
  [Buffer.from([0xff, 0xd8, 0xff]), '.jpg'],
  [Buffer.from([0x49, 0x49, 0x2a, 0x00]), '.tif'], // TIFF little-endian
  [Buffer.from([0x4d, 0x4d, 0x00, 0x2a]), '.tif'], // TIFF big-endian (legacy)
];

/** @throws UnsupportedImageFormatError si le contenu n'est ni PNG, ni JPEG, ni TIFF */
export function detectImageExtension(
  fileBuffer: Buffer,
): '.png' | '.jpg' | '.tif' {
  const match = SIGNATURES.find(([signature]) =>
    fileBuffer.subarray(0, signature.length).equals(signature),
  );
  if (!match) throw new UnsupportedImageFormatError();
  return match[1];
}

const MIME_BY_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.tif': 'image/tiff',
} as const;

/**
 * Type MIME du dépôt, lu dans le contenu (jamais depuis le mimetype client).
 * @throws UnsupportedImageFormatError si le contenu n'est ni PNG, ni JPEG, ni TIFF
 */
export function detectImageMimeType(fileBuffer: Buffer): string {
  return MIME_BY_EXTENSION[detectImageExtension(fileBuffer)];
}

export interface StoredImage {
  path: string;
  receivedSha256: string;
  displayableSha256: string;
  thumbPath: string | null;
  sourceSize: ImageSize | null;
}

export function thumbnailPath(storedPath: string): string {
  return `${storedPath.replace(/\.[^./]*$/, '')}_thumb.webp`;
}

async function storeThumbnail(
  storage: ImageStoragePort,
  converter: ImageConverterPort,
  displayable: Buffer,
  relativePath: string,
  logger: { warn(message: string): void },
): Promise<string | null> {
  const thumbnailKey = thumbnailPath(relativePath);
  try {
    return await storage.save(
      await converter.toDisplayThumbnail(displayable),
      thumbnailKey,
    );
  } catch (error) {
    logger.warn(
      `Vignette d'affichage non fabriquée pour la pièce ${relativePath} (${String(error)}) — « make backfill-thumbnails TENANT_DB=<base> » répare`,
    );
    return null;
  }
}

async function measureDisplayed(
  converter: ImageConverterPort,
  displayable: Buffer,
  relativePath: string,
  logger: { warn(message: string): void },
): Promise<ImageSize | null> {
  try {
    return await converter.displayedSize(displayable);
  } catch (error) {
    logger.warn(
      `Dimensions source non mesurées pour la pièce ${relativePath} (${String(error)})`,
    );
    return null;
  }
}

function digestOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function storeDisplayableImage(
  storage: ImageStoragePort,
  converter: ImageConverterPort,
  fileBuffer: Buffer,
  pathWithoutExtension: string,
  logger: { warn(message: string): void },
): Promise<StoredImage> {
  const extension = detectImageExtension(fileBuffer);
  const receivedSha256 = digestOf(fileBuffer);

  if (extension !== '.tif') {
    const relativePath = `${pathWithoutExtension}${extension}`;
    const path = await storage.save(fileBuffer, relativePath);
    return {
      path,
      receivedSha256,
      displayableSha256: receivedSha256,
      thumbPath: await storeThumbnail(
        storage,
        converter,
        fileBuffer,
        relativePath,
        logger,
      ),
      sourceSize: await measureDisplayed(
        converter,
        fileBuffer,
        relativePath,
        logger,
      ),
    };
  }

  const png = await converter.tiffToPng(fileBuffer);
  await storage.save(fileBuffer, `${pathWithoutExtension}_original.tif`);
  const relativePath = `${pathWithoutExtension}.png`;
  const path = await storage.save(png, relativePath);
  return {
    path,
    receivedSha256,
    displayableSha256: digestOf(png),
    thumbPath: await storeThumbnail(
      storage,
      converter,
      png,
      relativePath,
      logger,
    ),
    sourceSize: await measureDisplayed(converter, png, relativePath, logger),
  };
}

export function archivedOriginalPath(storedPath: string): string | null {
  return storedPath.endsWith('.png')
    ? `${storedPath.slice(0, -'.png'.length)}_original.tif`
    : null;
}
