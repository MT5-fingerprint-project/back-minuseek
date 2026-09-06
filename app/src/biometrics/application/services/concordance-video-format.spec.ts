import { UnsupportedConcordanceVideoFormatError } from '../../domain/concordance-video/errors/unsupported-concordance-video-format.error';
import {
  concordanceVideoMimeType,
  detectConcordanceVideoExtension,
} from './concordance-video-format';

const MP4_BYTES = Buffer.from([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);
const WEBM_BYTES = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02, 0x03]);
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 1, 2, 3]);

describe('detectConcordanceVideoExtension', () => {
  it('reconnaît un MP4 à sa boîte ftyp, qui ne commence pas le fichier', () => {
    expect(detectConcordanceVideoExtension(MP4_BYTES)).toBe('.mp4');
  });

  it('reconnaît un WebM à son entête EBML', () => {
    expect(detectConcordanceVideoExtension(WEBM_BYTES)).toBe('.webm');
  });

  it('refuse une image, même déposée sous un nom de vidéo', () => {
    expect(() => detectConcordanceVideoExtension(PNG_BYTES)).toThrow(
      UnsupportedConcordanceVideoFormatError,
    );
  });

  it('refuse un fichier trop court pour porter une signature', () => {
    expect(() => detectConcordanceVideoExtension(Buffer.from([0x1a]))).toThrow(
      UnsupportedConcordanceVideoFormatError,
    );
  });

  it('nomme le type MIME du conteneur', () => {
    expect(concordanceVideoMimeType('.mp4')).toBe('video/mp4');
    expect(concordanceVideoMimeType('.webm')).toBe('video/webm');
  });
});
