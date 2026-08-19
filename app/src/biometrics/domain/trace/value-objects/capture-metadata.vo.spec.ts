import { InvalidCaptureMetadataError } from '../errors/invalid-capture-metadata.error';
import { CaptureMetadata } from './capture-metadata.vo';

describe('CaptureMetadata', () => {
  describe('of', () => {
    it('exposes every capture field it was built with', () => {
      const metadata = CaptureMetadata.of({
        width: 3024,
        height: 4032,
        capturedAt: '2026-08-18T10:12:00.000Z',
        orientation: 6,
        focalLength: 6.86,
        deviceModel: 'iPhone 14 Pro',
      });

      expect(metadata.width).toBe(3024);
      expect(metadata.height).toBe(4032);
      expect(metadata.capturedAt).toEqual(new Date('2026-08-18T10:12:00.000Z'));
      expect(metadata.orientation).toBe(6);
      expect(metadata.focalLength).toBe(6.86);
      expect(metadata.deviceModel).toBe('iPhone 14 Pro');
    });
  });

  describe('dimensions', () => {
    it('accepts the smallest possible picture', () => {
      const metadata = CaptureMetadata.of({ width: 1, height: 1 });

      expect(metadata.width).toBe(1);
      expect(metadata.height).toBe(1);
    });

    it.each([0, -1, 3024.5, NaN, Infinity])(
      'rejects a width of %p',
      (width) => {
        expect(() => CaptureMetadata.of({ width, height: 4032 })).toThrow(
          InvalidCaptureMetadataError,
        );
      },
    );

    it.each([0, -1, 4032.5, NaN, Infinity])(
      'rejects a height of %p',
      (height) => {
        expect(() => CaptureMetadata.of({ width: 3024, height })).toThrow(
          InvalidCaptureMetadataError,
        );
      },
    );

    it('rejects a width without its height', () => {
      expect(() => CaptureMetadata.of({ width: 3024 })).toThrow(
        InvalidCaptureMetadataError,
      );
    });

    it('rejects a height without its width', () => {
      expect(() => CaptureMetadata.of({ height: 4032 })).toThrow(
        InvalidCaptureMetadataError,
      );
    });
  });

  describe('orientation', () => {
    it.each([1, 8])('accepts the EXIF orientation %p', (orientation) => {
      expect(CaptureMetadata.of({ orientation }).orientation).toBe(orientation);
    });

    it.each([0, 9, 6.5, NaN, Infinity, -1])(
      'rejects the orientation %p',
      (orientation) => {
        expect(() => CaptureMetadata.of({ orientation })).toThrow(
          InvalidCaptureMetadataError,
        );
      },
    );
  });

  describe('focalLength', () => {
    it('accepts a fractional focal length in millimetres', () => {
      expect(CaptureMetadata.of({ focalLength: 6.86 }).focalLength).toBe(6.86);
    });

    it.each([0, -0, -6.86, NaN, Infinity])(
      'rejects a focal length of %p',
      (focalLength) => {
        expect(() => CaptureMetadata.of({ focalLength })).toThrow(
          InvalidCaptureMetadataError,
        );
      },
    );
  });

  describe('capturedAt', () => {
    it('parses an ISO 8601 string into a date', () => {
      const metadata = CaptureMetadata.of({
        capturedAt: '2026-08-18T10:12:00.000Z',
      });

      expect(metadata.capturedAt).toEqual(new Date('2026-08-18T10:12:00.000Z'));
    });

    it.each(['nope', '', '2026-13-45T00:00:00.000Z'])(
      'rejects the unparsable capture date %p',
      (capturedAt) => {
        expect(() => CaptureMetadata.of({ capturedAt })).toThrow(
          InvalidCaptureMetadataError,
        );
      },
    );

    it('rejects an Invalid Date instance', () => {
      expect(() =>
        CaptureMetadata.of({ capturedAt: new Date('nope') }),
      ).toThrow(InvalidCaptureMetadataError);
    });

    it('does not keep a reference on the date it was given', () => {
      const given = new Date('2026-08-18T10:12:00.000Z');
      const metadata = CaptureMetadata.of({ capturedAt: given });

      given.setFullYear(1999);

      expect(metadata.capturedAt).toEqual(new Date('2026-08-18T10:12:00.000Z'));
    });

    it('cannot be corrupted through the date it returns', () => {
      const metadata = CaptureMetadata.of({
        capturedAt: '2026-08-18T10:12:00.000Z',
      });

      metadata.capturedAt?.setFullYear(1999);

      expect(metadata.capturedAt).toEqual(new Date('2026-08-18T10:12:00.000Z'));
    });
  });

  describe('deviceModel', () => {
    it('trims the surrounding whitespace', () => {
      expect(
        CaptureMetadata.of({ deviceModel: '  iPhone 14 Pro  ' }).deviceModel,
      ).toBe('iPhone 14 Pro');
    });

    it('accepts a model name of 120 characters', () => {
      const longest = 'a'.repeat(120);

      expect(CaptureMetadata.of({ deviceModel: longest }).deviceModel).toBe(
        longest,
      );
    });

    it('rejects a model name of 121 characters', () => {
      expect(() =>
        CaptureMetadata.of({ deviceModel: 'a'.repeat(121) }),
      ).toThrow(InvalidCaptureMetadataError);
    });

    it.each(['', '   '])('rejects the blank model name %p', (deviceModel) => {
      expect(() => CaptureMetadata.of({ deviceModel })).toThrow(
        InvalidCaptureMetadataError,
      );
    });
  });

  describe('adversarial input', () => {
    it('rejects a null width slipped past the type system', () => {
      expect(() =>
        CaptureMetadata.of({
          width: null as unknown as number,
          height: 4032,
        }),
      ).toThrow(InvalidCaptureMetadataError);
    });

    it('rejects a null device model slipped past the type system', () => {
      expect(() =>
        CaptureMetadata.of({ deviceModel: null as unknown as string }),
      ).toThrow(InvalidCaptureMetadataError);
    });
  });

  describe('empty', () => {
    it('leaves every capture field undefined', () => {
      const metadata = CaptureMetadata.empty();

      expect(metadata.width).toBeUndefined();
      expect(metadata.height).toBeUndefined();
      expect(metadata.capturedAt).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      expect(metadata.focalLength).toBeUndefined();
      expect(metadata.deviceModel).toBeUndefined();
    });
  });
});
