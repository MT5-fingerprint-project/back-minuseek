import {
  archivedOriginalPath,
  detectImageExtension,
  UnsupportedImageFormatError,
} from './displayable-image';

describe('detectImageExtension', () => {
  it.each([
    ['PNG', [0x89, 0x50, 0x4e, 0x47], '.png'],
    ['JPEG', [0xff, 0xd8, 0xff, 0xe0], '.jpg'],
    ['TIFF little-endian', [0x49, 0x49, 0x2a, 0x00], '.tif'],
    ['TIFF big-endian', [0x4d, 0x4d, 0x00, 0x2a], '.tif'],
  ])('detects %s from the magic bytes', (_label, magic, expected) => {
    const buffer = Buffer.concat([Buffer.from(magic), Buffer.from('payload')]);
    expect(detectImageExtension(buffer)).toBe(expected);
  });

  it('rejects a buffer that is not a supported image, whatever its claimed name', () => {
    expect(() => detectImageExtension(Buffer.from('not-an-image'))).toThrow(
      UnsupportedImageFormatError,
    );
    expect(() => detectImageExtension(Buffer.alloc(0))).toThrow(
      UnsupportedImageFormatError,
    );
  });
});

describe('archivedOriginalPath', () => {
  it('derives the <id>_original.tif archive path from a stored PNG', () => {
    expect(archivedOriginalPath('media/case-1/traces/trace-1.png')).toBe(
      'media/case-1/traces/trace-1_original.tif',
    );
  });

  it('returns null for a non-PNG stored path (no archive possible)', () => {
    expect(archivedOriginalPath('media/case-1/traces/trace-1.jpg')).toBeNull();
  });
});
