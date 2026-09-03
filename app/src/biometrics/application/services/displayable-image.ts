import { createHash } from 'node:crypto';
import { ImageConverterPort } from '../ports/image-converter.port';
import { ImageStoragePort } from '../ports/image-storage.port';

export class UnsupportedImageFormatError extends Error {
  constructor() {
    super("Format d'image non supporté : PNG, JPEG ou TIFF attendu");
  }
}

// Le format est lu dans le contenu (magic bytes), jamais depuis le nom de
// fichier ni le mimetype, tous deux fournis par le client (ADR-0012).
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
}

/**
 * Chemin de la variante réduite servie à l'affichage. Le suffixe se pose AVANT
 * le point : data-minuseek résout la pièce à comparer en listant le préfixe
 * `{id}.` et prend le premier blob, donc `{id}.thumb.webp` la ferait comparer.
 */
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
    // Rien de décoratif ne peut refuser une pièce : sans vignette, l'affichage
    // retombe sur l'original. Journalisé parce qu'un droit d'écriture perdu sur
    // le préfixe tarirait toutes les vignettes sans faire échouer un seul dépôt.
    logger.warn(
      `Vignette d'affichage non fabriquée pour la pièce ${relativePath} (${String(error)}) — « make backfill-thumbnails TENANT_DB=<base> » répare`,
    );
    return null;
  }
}

function digestOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Un TIFF est converti en PNG (lossless) pour l'affichage navigateur ;
 * l'original est archivé sous `<id>_original.tif`.
 */
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
  };
}

/**
 * Chemin de l'original TIFF archivé à côté d'un PNG affichable.
 * Null si l'image stockée n'est pas un PNG (pas d'archive possible).
 */
export function archivedOriginalPath(storedPath: string): string | null {
  return storedPath.endsWith('.png')
    ? `${storedPath.slice(0, -'.png'.length)}_original.tif`
    : null;
}
