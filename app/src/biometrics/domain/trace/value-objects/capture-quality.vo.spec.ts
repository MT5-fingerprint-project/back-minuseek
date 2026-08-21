import { InvalidCaptureQualityError } from '../errors/invalid-capture-quality.error';
import { CaptureQuality } from './capture-quality.vo';

describe('CaptureQuality', () => {
  describe('of', () => {
    it('exposes the blur score and the verdict it was built with', () => {
      const quality = CaptureQuality.of({ blurScore: 128.4, passed: true });

      expect(quality.blurScore).toBe(128.4);
      expect(quality.passed).toBe(true);
    });

    it('keeps a failed check, which is the one the lab most wants to see', () => {
      const quality = CaptureQuality.of({ blurScore: 12.5, passed: false });

      expect(quality.blurScore).toBe(12.5);
      expect(quality.passed).toBe(false);
    });
  });

  describe('blurScore', () => {
    it('accepts a perfectly uniform picture, whose variance is zero', () => {
      expect(CaptureQuality.of({ blurScore: 0, passed: false }).blurScore).toBe(
        0,
      );
    });

    it.each([-0.0001, -1, NaN, Infinity, -Infinity])(
      'rejects the blur score %p',
      (blurScore) => {
        expect(() => CaptureQuality.of({ blurScore, passed: true })).toThrow(
          InvalidCaptureQualityError,
        );
      },
    );

    it.each([
      ['a numeric string', '12'],
      ['null', null],
      ['undefined', undefined],
      ['an array', []],
      ['an object', {}],
    ])('rejects a blur score given as %s', (_label, blurScore) => {
      expect(() =>
        CaptureQuality.of({ blurScore: blurScore as number, passed: true }),
      ).toThrow(InvalidCaptureQualityError);
    });

    it('names the offending field in the error message', () => {
      expect(() => CaptureQuality.of({ blurScore: -1, passed: true })).toThrow(
        /blurScore/,
      );
    });
  });

  describe('passed', () => {
    it.each([
      ['the string "true"', 'true'],
      ['the number 1', 1],
      ['null', null],
      ['undefined', undefined],
    ])('rejects a verdict given as %s', (_label, passed) => {
      expect(() =>
        CaptureQuality.of({
          blurScore: 42,
          passed: passed as unknown as boolean,
        }),
      ).toThrow(InvalidCaptureQualityError);
    });

    it('names the offending field in the error message', () => {
      expect(() =>
        CaptureQuality.of({
          blurScore: 42,
          passed: 'true' as unknown as boolean,
        }),
      ).toThrow(/passed/);
    });
  });

  describe('toPrimitives', () => {
    it('renders the shape persisted in the captureQuality column', () => {
      expect(
        CaptureQuality.of({ blurScore: 128.4, passed: true }).toPrimitives(),
      ).toEqual({ blurScore: 128.4, passed: true });
    });

    it('hands out a fresh object, so a caller cannot corrupt the value object', () => {
      const quality = CaptureQuality.of({ blurScore: 128.4, passed: true });

      const primitives = quality.toPrimitives();
      primitives.blurScore = 0;
      primitives.passed = false;

      expect(quality.toPrimitives()).toEqual({
        blurScore: 128.4,
        passed: true,
      });
    });
  });

  describe('fromPersistence', () => {
    it('rebuilds the value object stored by toPrimitives', () => {
      const stored = CaptureQuality.of({
        blurScore: 128.4,
        passed: true,
      }).toPrimitives();

      const rebuilt = CaptureQuality.fromPersistence(stored);

      expect(rebuilt?.toPrimitives()).toEqual({
        blurScore: 128.4,
        passed: true,
      });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
    ])('reads %s as an absent check', (_label, stored) => {
      expect(CaptureQuality.fromPersistence(stored)).toBeNull();
    });

    it.each([
      ['a JSON string', '{"blurScore":1,"passed":true}'],
      ['an array', [{ blurScore: 1, passed: true }]],
      ['a number', 12],
    ])(
      'rejects %s stored in the column, pointing at the expected shape',
      (_label, stored) => {
        expect(() => CaptureQuality.fromPersistence(stored)).toThrow(
          InvalidCaptureQualityError,
        );
        expect(() => CaptureQuality.fromPersistence(stored)).toThrow(
          /objet \{ blurScore, passed \}/,
        );
      },
    );

    it.each([
      ['an object missing passed', { blurScore: 1 }],
      ['an object missing blurScore', { passed: true }],
      ['an object with a string verdict', { blurScore: 1, passed: 'true' }],
    ])('rejects %s stored in the column', (_label, stored) => {
      expect(() => CaptureQuality.fromPersistence(stored)).toThrow(
        InvalidCaptureQualityError,
      );
    });

    it('ignores an extra key left in the column by an older writer', () => {
      const rebuilt = CaptureQuality.fromPersistence({
        blurScore: 1,
        passed: true,
        perpendicularityDeviation: 3,
      });

      expect(rebuilt?.toPrimitives()).toEqual({ blurScore: 1, passed: true });
    });
  });
});
