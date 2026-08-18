import { FileDigest, InvalidFileDigestError } from './file-digest.vo';

const TEST_IMAGE_SHA256 =
  '9febe01bd41bfb69683e29d711d8adffc9ae38de17a6873464b416f3b67398b6';

describe('FileDigest', () => {
  it('scelle un buffer par son SHA-256 hexadécimal', () => {
    const digest = FileDigest.ofBuffer(Buffer.from('test-image'));

    expect(digest.getValue()).toBe(TEST_IMAGE_SHA256);
  });

  it('scelle un buffer vide plutôt que de le refuser', () => {
    expect(FileDigest.ofBuffer(Buffer.alloc(0)).getValue()).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('change de valeur dès qu’un octet change', () => {
    const original = FileDigest.ofBuffer(Buffer.from('test-image'));
    const altered = FileDigest.ofBuffer(Buffer.from('test-imagf'));

    expect(altered.equals(original)).toBe(false);
  });

  it('reconnaît deux scellés identiques', () => {
    expect(
      FileDigest.from(TEST_IMAGE_SHA256).equals(
        FileDigest.ofBuffer(Buffer.from('test-image')),
      ),
    ).toBe(true);
  });

  it.each([
    ['trop court', 'a'.repeat(63)],
    ['trop long', 'a'.repeat(65)],
    ['en majuscules', TEST_IMAGE_SHA256.toUpperCase()],
    ['hors hexadécimal', 'z'.repeat(64)],
    ['vide', ''],
  ])('refuse un scellé %s', (_label, raw) => {
    expect(() => FileDigest.from(raw)).toThrow(InvalidFileDigestError);
  });
});
