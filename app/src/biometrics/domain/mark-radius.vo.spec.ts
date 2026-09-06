import { InvalidMarkRadiusError, MarkRadius } from './mark-radius.vo';

describe('MarkRadius', () => {
  it('holds the value it was created with', () => {
    expect(MarkRadius.of(36).getValue()).toBe(36);
  });

  it.each([2, 2000])('accepts the boundary value %d', (pixels) => {
    expect(MarkRadius.of(pixels).getValue()).toBe(pixels);
  });

  it.each([1, 2001])(
    'rejects %d, just outside the accepted range',
    (pixels) => {
      expect(() => MarkRadius.of(pixels)).toThrow(InvalidMarkRadiusError);
    },
  );

  it.each([0, -5, NaN, Infinity, -Infinity])(
    'rejects %s as not a plausible marker size',
    (pixels) => {
      expect(() => MarkRadius.of(pixels)).toThrow(InvalidMarkRadiusError);
    },
  );

  it('rejects a decimal radius: a marker is drawn on whole source pixels', () => {
    expect(() => MarkRadius.of(12.5)).toThrow(InvalidMarkRadiusError);
  });

  it('names the received value and the two bounds in the message it throws', () => {
    expect(() => MarkRadius.of(1)).toThrow(
      '"1" n\'est pas une taille de repère plausible : attendu un entier entre 2 et 2000 pixels',
    );
  });

  it('reconstitutes an empty value from a null stored radius', () => {
    expect(MarkRadius.fromPersistence(null)).toBeNull();
  });

  it('reconstitutes a stored radius through the same guard as the factory', () => {
    expect(MarkRadius.fromPersistence(36)?.getValue()).toBe(36);
  });

  it('refuses a stored radius outside the accepted range', () => {
    expect(() => MarkRadius.fromPersistence(2001)).toThrow(
      InvalidMarkRadiusError,
    );
  });

  it('compares by value: two instances built from the same number are equal', () => {
    expect(MarkRadius.of(36).equals(MarkRadius.of(36))).toBe(true);
  });

  it('compares by value: two instances built from different numbers are not equal', () => {
    expect(MarkRadius.of(36).equals(MarkRadius.of(48))).toBe(false);
  });
});
