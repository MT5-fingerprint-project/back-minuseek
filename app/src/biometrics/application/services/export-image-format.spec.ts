import { UnsupportedExportFormatError } from '../../domain/exported-image/errors/unsupported-export-format.error';
import { detectExportImageExtension } from './export-image-format';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const TIFF_LE_BYTES = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
const TIFF_BE_BYTES = Buffer.from([0x4d, 0x4d, 0x00, 0x2a]);

describe('detectExportImageExtension', () => {
  it('reconnaît un PNG', () => {
    expect(detectExportImageExtension(PNG_BYTES)).toBe('.png');
  });

  it('reconnaît un JPEG', () => {
    expect(detectExportImageExtension(JPEG_BYTES)).toBe('.jpg');
  });

  it('refuse un TIFF (little-endian) : les exports ne se convertissent pas', () => {
    expect(() => detectExportImageExtension(TIFF_LE_BYTES)).toThrow(
      UnsupportedExportFormatError,
    );
  });

  it('refuse un TIFF (big-endian)', () => {
    expect(() => detectExportImageExtension(TIFF_BE_BYTES)).toThrow(
      UnsupportedExportFormatError,
    );
  });

  it('refuse un contenu sans signature reconnue', () => {
    expect(() =>
      detectExportImageExtension(Buffer.from('pas une image')),
    ).toThrow(UnsupportedExportFormatError);
  });

  it('refuse un buffer vide', () => {
    expect(() => detectExportImageExtension(Buffer.alloc(0))).toThrow(
      UnsupportedExportFormatError,
    );
  });
});
