import {
  ImageResolution,
  InvalidImageResolutionError,
} from './image-resolution.vo';

describe('ImageResolution', () => {
  it('holds the value it was created with', () => {
    expect(ImageResolution.of(500).getValue()).toBe(500);
  });

  it.each([50, 10_000])('accepts the boundary value %d', (dpi) => {
    expect(ImageResolution.of(dpi).getValue()).toBe(dpi);
  });

  it.each([49, 10_001])(
    'rejects %d, just outside the accepted range',
    (dpi) => {
      expect(() => ImageResolution.of(dpi)).toThrow(
        InvalidImageResolutionError,
      );
    },
  );

  it.each([0, -100, NaN, Infinity, -Infinity])(
    'rejects %s as not a plausible resolution',
    (dpi) => {
      expect(() => ImageResolution.of(dpi)).toThrow(
        InvalidImageResolutionError,
      );
    },
  );

  it('accepts a non-integer value, as produced by the ruler calibration', () => {
    expect(ImageResolution.of(1207.34).getValue()).toBe(1207.34);
  });

  it('rejects the message it throws to name the received value and the two bounds', () => {
    expect(() => ImageResolution.of(3)).toThrow(
      '"3" n\'est pas une résolution plausible : attendu entre 50 et 10000 points par pouce',
    );
  });

  it('reconstitutes an empty value from a null stored resolution', () => {
    expect(ImageResolution.fromPersistence(null)).toBeNull();
  });

  it('reconstitutes a stored resolution through the same guard as the factory', () => {
    const resolution = ImageResolution.fromPersistence(1207.34);

    expect(resolution?.getValue()).toBe(1207.34);
  });

  it('refuses a stored resolution outside the accepted range', () => {
    expect(() => ImageResolution.fromPersistence(10_001)).toThrow(
      InvalidImageResolutionError,
    );
  });

  it('compares by value: two instances built from the same number are equal', () => {
    expect(ImageResolution.of(500).equals(ImageResolution.of(500))).toBe(true);
  });

  it('compares by value: two instances built from different numbers are not equal', () => {
    expect(ImageResolution.of(500).equals(ImageResolution.of(501))).toBe(false);
  });
});
