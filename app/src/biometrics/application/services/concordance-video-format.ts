import { UnsupportedConcordanceVideoFormatError } from '../../domain/concordance-video/errors/unsupported-concordance-video-format.error';

// Format lu dans le contenu (magic bytes), jamais depuis le nom de fichier ni
// le mimetype (ADR-0012). Le WebM est un flux EBML, reconnaissable dès le
// premier octet ; le MP4 se reconnaît à sa boîte `ftyp`, qui suit les quatre
// octets de taille — d'où la lecture décalée.
const EBML = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
const FTYP = Buffer.from('ftyp', 'ascii');
const FTYP_OFFSET = 4;

/** @throws UnsupportedConcordanceVideoFormatError si le contenu n'est ni MP4, ni WebM */
export function detectConcordanceVideoExtension(
  buffer: Buffer,
): '.mp4' | '.webm' {
  if (buffer.subarray(0, EBML.length).equals(EBML)) return '.webm';
  if (buffer.subarray(FTYP_OFFSET, FTYP_OFFSET + FTYP.length).equals(FTYP)) {
    return '.mp4';
  }
  throw new UnsupportedConcordanceVideoFormatError();
}

export function concordanceVideoMimeType(extension: '.mp4' | '.webm'): string {
  return extension === '.mp4' ? 'video/mp4' : 'video/webm';
}
