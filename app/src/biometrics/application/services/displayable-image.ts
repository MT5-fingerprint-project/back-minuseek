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
): Promise<StoredImage> {
  const extension = detectImageExtension(fileBuffer);
  const receivedSha256 = digestOf(fileBuffer);

  if (extension !== '.tif') {
    const path = await storage.save(
      fileBuffer,
      `${pathWithoutExtension}${extension}`,
    );
    return { path, receivedSha256, displayableSha256: receivedSha256 };
  }

  const png = await converter.tiffToPng(fileBuffer);
  await storage.save(fileBuffer, `${pathWithoutExtension}_original.tif`);
  const path = await storage.save(png, `${pathWithoutExtension}.png`);
  return { path, receivedSha256, displayableSha256: digestOf(png) };
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
