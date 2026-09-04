import { ReferencePrint } from './reference-print';
import { ReferencePrintImageAlreadyDestroyedError } from '../errors/reference-print-image-already-destroyed.error';
import { FileDigest, InvalidFileDigestError } from '../../file-digest.vo';
import { InvalidImageResolutionError } from '../../image-resolution.vo';
import { FingerPosition } from '../value-objects/finger-position.vo';
import { AlreadyWithdrawnError } from '../../withdrawal/errors/already-withdrawn.error';
import { NotWithdrawnError } from '../../withdrawal/errors/not-withdrawn.error';

const WITHDRAWN_AT = new Date('2026-08-12T09:00:00.000Z');

const CLEAN_PRINT_SHA256 =
  '70ccc2a604c5f59ed11bdd4b2eb82763359189b62487cb0326c1a05b07769665';

describe('ReferencePrint', () => {
  const seal = () => FileDigest.ofBuffer(Buffer.from('clean-print'));

  describe('create', () => {
    it('builds a reference print with id, path and caseId', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'media/case-1/referencePrints/r-1.png',
        caseId: 'case-1',
        sha256: seal(),
        displayableSha256: seal(),
      });

      expect(rp.id).toBe('r-1');
      expect(rp.path).toBe('media/case-1/referencePrints/r-1.png');
      expect(rp.caseId).toBe('case-1');
      expect(rp.subjectId).toBeNull();
      expect(rp.position).toBeNull();
    });

    it('carries an optional subjectId and finger position', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'case-1',
        sha256: seal(),
        displayableSha256: seal(),
        subjectId: 'subject-1',
        position: FingerPosition.from('RIGHT_THUMB'),
      });

      expect(rp.subjectId).toBe('subject-1');
      expect(rp.position?.getValue()).toBe('RIGHT_THUMB');
    });

    it('carries the seal taken on the deposited bytes', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
        displayableSha256: seal(),
      });

      expect(rp.sha256).toBe(CLEAN_PRINT_SHA256);
    });

    it('rejects an empty id', () => {
      expect(() =>
        ReferencePrint.create({
          id: '',
          path: 'p',
          caseId: 'c-1',
          sha256: seal(),
          displayableSha256: seal(),
        }),
      ).toThrow();
    });

    it('rejects an empty path', () => {
      expect(() =>
        ReferencePrint.create({
          id: 'r-1',
          path: '',
          caseId: 'c-1',
          sha256: seal(),
          displayableSha256: seal(),
        }),
      ).toThrow();
    });

    it('rejects an empty caseId', () => {
      expect(() =>
        ReferencePrint.create({
          id: 'r-1',
          path: 'p',
          caseId: '',
          sha256: seal(),
          displayableSha256: seal(),
        }),
      ).toThrow();
    });
  });

  describe('la vignette d’affichage', () => {
    const THUMB = 'media/case-9/reference-prints/rp-1_thumb.webp';

    it('carries the display thumbnail stored alongside the piece', () => {
      const print = ReferencePrint.create({
        id: 'rp-1',
        path: 'media/case-9/reference-prints/rp-1.png',
        caseId: 'case-9',
        sha256: seal(),
        displayableSha256: seal(),
        thumbPath: THUMB,
      });

      expect(print.thumbPath).toBe(THUMB);
      expect(print.toPrimitives().thumbPath).toBe(THUMB);
    });

    it('carries no thumbnail when the deposit could not build one', () => {
      const print = ReferencePrint.create({
        id: 'rp-1',
        path: 'media/case-9/reference-prints/rp-1.png',
        caseId: 'case-9',
        sha256: seal(),
        displayableSha256: seal(),
      });

      expect(print.thumbPath).toBeNull();
    });

    it.each([
      ['a stored thumbnail', THUMB],
      ['no thumbnail', null],
    ])('round-trips %s through primitives', (_label, thumbPath) => {
      const print = ReferencePrint.create({
        id: 'rp-1',
        path: 'media/case-9/reference-prints/rp-1.png',
        caseId: 'case-9',
        sha256: seal(),
        displayableSha256: seal(),
        thumbPath,
      });

      const reloaded = ReferencePrint.reconstitute(print.toPrimitives());

      expect(reloaded.thumbPath).toBe(thumbPath);
    });

    const printWithThumbnail = () =>
      ReferencePrint.create({
        id: 'rp-1',
        path: 'media/case-9/reference-prints/rp-1.png',
        caseId: 'case-9',
        sha256: seal(),
        displayableSha256: seal(),
        thumbPath: THUMB,
      });

    it('forgets its thumbnail when the image is destroyed', () => {
      const print = printWithThumbnail();

      print.markImageDestroyed(new Date('2026-09-01T10:00:00.000Z'));

      expect(print.thumbPath).toBeNull();
      expect(print.toPrimitives().thumbPath).toBeNull();
    });

    it('keeps the thumbnail of a piece that is only withdrawn', () => {
      const print = printWithThumbnail();

      print.withdraw('DUPLICATE', WITHDRAWN_AT);

      expect(print.thumbPath).toBe(THUMB);
    });

    it('refuses a second destruction and leaves the erased column alone', () => {
      const print = printWithThumbnail();
      print.markImageDestroyed(new Date('2026-09-01T10:00:00.000Z'));

      expect(() =>
        print.markImageDestroyed(new Date('2026-09-02T10:00:00.000Z')),
      ).toThrow(ReferencePrintImageAlreadyDestroyedError);
      expect(print.imageDestroyedAt).toEqual(
        new Date('2026-09-01T10:00:00.000Z'),
      );
      expect(print.thumbPath).toBeNull();
    });
  });

  describe('reconstitute', () => {
    it('rebuilds a reference print from primitives', () => {
      const rp = ReferencePrint.reconstitute({
        id: 'r-1',
        path: 'media/case-1/referencePrints/r-1.png',
        caseId: 'case-1',
        sha256: CLEAN_PRINT_SHA256,
        displayableSha256: CLEAN_PRINT_SHA256,
        subjectId: 'subject-1',
        position: 'LEFT_PALM',
        withdrawnAt: null,
        withdrawalMotive: null,
        withdrawalMotiveDetail: null,
        imageDestroyedAt: null,
        resolutionDpi: null,
        thumbPath: null,
        sourceWidth: null,
        sourceHeight: null,
      });

      expect(rp.id).toBe('r-1');
      expect(rp.caseId).toBe('case-1');
      expect(rp.sha256).toBe(CLEAN_PRINT_SHA256);
      expect(rp.subjectId).toBe('subject-1');
      expect(rp.position?.getValue()).toBe('LEFT_PALM');
    });

    it('rebuilds a reference print deposited before the seal existed', () => {
      const rp = ReferencePrint.reconstitute({
        id: 'r-1',
        path: 'p',
        caseId: 'case-1',
        sha256: null,
        displayableSha256: null,
        subjectId: null,
        position: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        withdrawalMotiveDetail: null,
        imageDestroyedAt: null,
        resolutionDpi: null,
        thumbPath: null,
        sourceWidth: null,
        sourceHeight: null,
      });

      expect(rp.sha256).toBeNull();
    });

    it('refuses a stored seal that is not a SHA-256', () => {
      expect(() =>
        ReferencePrint.reconstitute({
          id: 'r-1',
          path: 'p',
          caseId: 'case-1',
          sha256: 'not-a-hash',
          displayableSha256: 'not-a-hash',
          subjectId: null,
          position: null,
          withdrawnAt: null,
          withdrawalMotive: null,
          withdrawalMotiveDetail: null,
          imageDestroyedAt: null,
          resolutionDpi: null,
          thumbPath: null,
          sourceWidth: null,
          sourceHeight: null,
        }),
      ).toThrow(InvalidFileDigestError);
    });
  });

  describe('toPrimitives', () => {
    it('emits id, path, caseId, seal, subjectId and position', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
        displayableSha256: seal(),
      });

      expect(rp.toPrimitives()).toEqual({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: CLEAN_PRINT_SHA256,
        displayableSha256: CLEAN_PRINT_SHA256,
        subjectId: null,
        position: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        withdrawalMotiveDetail: null,
        imageDestroyedAt: null,
        resolutionDpi: null,
        thumbPath: null,
        sourceWidth: null,
        sourceHeight: null,
      });
    });
  });
  describe('calibrate', () => {
    it('starts uncalibrated', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
      });

      expect(rp.resolutionDpi).toBeNull();
    });

    it('sets the resolution in points per inch of the source image', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
      });

      rp.calibrate(1207.34);

      expect(rp.resolutionDpi).toBe(1207.34);
    });

    it('replaces the previous value when recalibrated', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
      });
      rp.calibrate(500);

      rp.calibrate(600);

      expect(rp.resolutionDpi).toBe(600);
    });

    it('refuses a resolution outside the accepted range', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
      });

      expect(() => rp.calibrate(3)).toThrow(InvalidImageResolutionError);
      expect(rp.resolutionDpi).toBeNull();
    });

    it('round-trips a calibrated resolution', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
      });
      rp.calibrate(1207.34);

      const rebuilt = ReferencePrint.reconstitute(rp.toPrimitives());

      expect(rebuilt.resolutionDpi).toBe(1207.34);
    });
  });

  describe('withdrawal', () => {
    const withdrawnPrint = () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'media/case-1/referencePrints/r-1.png',
        caseId: 'case-1',
        sha256: seal(),
        displayableSha256: seal(),
      });
      rp.withdraw('WRONG_ATTRIBUTION', WITHDRAWN_AT);
      return rp;
    };

    it('records the date and the motive of the withdrawal', () => {
      const rp = withdrawnPrint();

      expect(rp.isWithdrawn).toBe(true);
      expect(rp.withdrawnAt).toBe(WITHDRAWN_AT);
      expect(rp.toPrimitives()).toMatchObject({
        withdrawnAt: WITHDRAWN_AT,
        withdrawalMotive: 'WRONG_ATTRIBUTION',
        withdrawalMotiveDetail: null,
        imageDestroyedAt: null,
        resolutionDpi: null,
        thumbPath: null,
        sourceWidth: null,
        sourceHeight: null,
      });
    });

    it('refuses to withdraw a piece already out of the case', () => {
      const rp = withdrawnPrint();

      expect(() => rp.withdraw('DUPLICATE', WITHDRAWN_AT)).toThrow(
        AlreadyWithdrawnError,
      );
    });

    it('erases both columns when the piece comes back', () => {
      const rp = withdrawnPrint();

      rp.restore();

      expect(rp.isWithdrawn).toBe(false);
      expect(rp.toPrimitives()).toMatchObject({
        withdrawnAt: null,
        withdrawalMotive: null,
        withdrawalMotiveDetail: null,
        imageDestroyedAt: null,
        resolutionDpi: null,
        thumbPath: null,
        sourceWidth: null,
        sourceHeight: null,
      });
    });

    it('refuses to restore a piece that never left', () => {
      const rp = ReferencePrint.create({
        id: 'r-2',
        path: 'p',
        caseId: 'case-1',
        sha256: seal(),
        displayableSha256: seal(),
      });

      expect(() => rp.restore()).toThrow(NotWithdrawnError);
    });

    it('reads a withdrawn piece back from its columns', () => {
      const rp = ReferencePrint.reconstitute({
        id: 'r-1',
        path: 'p',
        caseId: 'case-1',
        sha256: null,
        displayableSha256: null,
        subjectId: null,
        position: null,
        withdrawnAt: WITHDRAWN_AT,
        withdrawalMotive: 'MISFILED',
        withdrawalMotiveDetail: null,
        imageDestroyedAt: null,
        resolutionDpi: null,
        thumbPath: null,
        sourceWidth: null,
        sourceHeight: null,
      });

      expect(rp.isWithdrawn).toBe(true);
      expect(rp.withdrawnAt).toBe(WITHDRAWN_AT);
    });
  });
});
