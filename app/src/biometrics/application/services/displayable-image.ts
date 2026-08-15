import path from 'node:path';
import { ImageConverterPort } from '../ports/image-converter.port';
import { ImageStoragePort } from '../ports/image-storage.port';

const TIFF_EXTENSIONS = new Set(['.tif', '.tiff']);

/**
 * Stocke l'image affichable et retourne son chemin (celui persisté en base).
 * Un TIFF est converti en PNG (lossless) pour l'affichage navigateur ;
 * l'original est archivé sous le même id avec l'extension `.tif`.
 */
export async function storeDisplayableImage(
  storage: ImageStoragePort,
  converter: ImageConverterPort,
  fileBuffer: Buffer,
  originalName: string,
  pathWithoutExtension: string,
): Promise<string> {
  const extension = path.extname(originalName).toLowerCase() || '.bin';
  if (!TIFF_EXTENSIONS.has(extension)) {
    return storage.save(fileBuffer, `${pathWithoutExtension}${extension}`);
  }
  
  const png = await converter.tiffToPng(fileBuffer);
  await storage.save(fileBuffer, `${pathWithoutExtension}.tif`);
  return storage.save(png, `${pathWithoutExtension}.png`);
}

/**
 * Chemin de l'original TIFF archivé à côté d'un PNG affichable.
 * Null si l'image stockée n'est pas un PNG (pas d'archive possible).
 */
export function archivedOriginalPath(storedPath: string): string | null {
  return storedPath.endsWith('.png')
    ? `${storedPath.slice(0, -'.png'.length)}.tif`
    : null;
}
