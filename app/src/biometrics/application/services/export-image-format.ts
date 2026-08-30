import { UnsupportedExportFormatError } from '../../domain/exported-image/errors/unsupported-export-format.error';

// Format lu dans le contenu (magic bytes), jamais depuis le nom de fichier ni
// le mimetype (ADR-0012). Contrairement au dépôt d'une trace, un export ne
// convertit jamais un TIFF : il est refusé comme n'importe quel autre format.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

/** @throws UnsupportedExportFormatError si le contenu n'est ni PNG, ni JPEG */
export function detectExportImageExtension(buffer: Buffer): '.png' | '.jpg' {
  if (buffer.subarray(0, PNG.length).equals(PNG)) return '.png';
  if (buffer.subarray(0, JPEG.length).equals(JPEG)) return '.jpg';
  throw new UnsupportedExportFormatError();
}

export function exportImageMimeType(extension: '.png' | '.jpg'): string {
  return extension === '.png' ? 'image/png' : 'image/jpeg';
}
