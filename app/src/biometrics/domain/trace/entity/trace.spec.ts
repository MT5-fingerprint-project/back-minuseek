import { FileDigest, InvalidFileDigestError } from '../../file-digest.vo';
import { InvalidImageResolutionError } from '../../image-resolution.vo';
import { CaseUnavailableForTraceError } from '../errors/case-unavailable-for-trace.error';
import { CaseNotOpenForWorkError } from '../../errors/case-not-open-for-work.error';
import { InvalidTraceTransitionError } from '../errors/invalid-trace-transition.error';
import { CaptureMetadata } from '../value-objects/capture-metadata.vo';
import { CaptureQuality } from '../value-objects/capture-quality.vo';
import { InvalidCaptureQualityError } from '../errors/invalid-capture-quality.error';
import { ExploitabilityScore } from '../value-objects/exploitability-score.vo';
import { TraceStatusEnum } from '../value-objects/trace-status.vo';
import { AlreadyWithdrawnError } from '../../withdrawal/errors/already-withdrawn.error';
import { NotWithdrawnError } from '../../withdrawal/errors/not-withdrawn.error';
import { InvalidWithdrawalMotiveError } from '../../withdrawal/withdrawal.vo';
import { Trace } from './trace';

const WITHDRAWN_AT = new Date('2026-08-12T09:00:00.000Z');

const TEST_IMAGE_SHA256 =
  '9febe01bd41bfb69683e29d711d8adffc9ae38de17a6873464b416f3b67398b6';

describe('Trace', () => {
  const baseProps = {
    id: 't-1',
    number: 3,
    path: 'media/case-9/traces/t-1.png',
    caseId: 'case-9',
    sha256: FileDigest.ofBuffer(Buffer.from('test-image')),
    displayableSha256: FileDigest.ofBuffer(Buffer.from('test-image')),
  };

  describe('upload', () => {
    it('starts in RECEIVED status with no score', () => {
      const trace = Trace.upload(baseProps);

      expect(trace.id).toBe('t-1');
      expect(trace.status).toBe(TraceStatusEnum.RECEIVED);
      expect(trace.score).toBeNull();
      expect(trace.caseId).toBe('case-9');
    });

    it('carries the seal taken on the deposited bytes', () => {
      const trace = Trace.upload(baseProps);

      expect(trace.sha256).toBe(TEST_IMAGE_SHA256);
    });

    it('carries no capture metadata when none is provided', () => {
      const trace = Trace.upload(baseProps);

      expect(trace.toPrimitives()).toEqual({
        id: 't-1',
        number: 3,
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        displayableSha256: TEST_IMAGE_SHA256,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
        captureQuality: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });
    });

    it('flattens the capture metadata onto the persisted primitives', () => {
      const trace = Trace.upload({
        ...baseProps,
        captureMetadata: CaptureMetadata.of({
          width: 3024,
          height: 4032,
          capturedAt: '2026-08-18T10:12:00.000Z',
          orientation: 6,
          focalLength: 6.86,
          deviceModel: 'iPhone 14 Pro',
        }),
      });

      expect(trace.toPrimitives()).toEqual({
        id: 't-1',
        number: 3,
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        displayableSha256: TEST_IMAGE_SHA256,
        captureWidth: 3024,
        captureHeight: 4032,
        capturedAt: new Date('2026-08-18T10:12:00.000Z'),
        captureOrientation: 6,
        captureFocalLength: 6.86,
        captureDeviceModel: 'iPhone 14 Pro',
        captureQuality: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });
    });

    it('flattens the capture quality check onto the persisted primitives', () => {
      const trace = Trace.upload({
        ...baseProps,
        captureQuality: CaptureQuality.of({ blurScore: 128.4, passed: true }),
      });

      expect(trace.toPrimitives().captureQuality).toEqual({
        blurScore: 128.4,
        passed: true,
      });
    });

    it('exposes the capture quality check it was uploaded with', () => {
      const trace = Trace.upload({
        ...baseProps,
        captureQuality: CaptureQuality.of({ blurScore: 12.5, passed: false }),
      });

      expect(trace.captureQuality?.blurScore).toBe(12.5);
      expect(trace.captureQuality?.passed).toBe(false);
    });

    it('carries no capture quality check when the upload provides none', () => {
      expect(Trace.upload(baseProps).captureQuality).toBeNull();
    });

    it('exposes the capture metadata it was uploaded with', () => {
      const captureMetadata = CaptureMetadata.of({ orientation: 6 });

      const trace = Trace.upload({ ...baseProps, captureMetadata });

      expect(trace.captureMetadata.orientation).toBe(6);
    });

    it('rejects an empty id', () => {
      expect(() => Trace.upload({ ...baseProps, id: '' })).toThrow();
    });

    it('rejects an empty path', () => {
      expect(() => Trace.upload({ ...baseProps, path: '' })).toThrow();
    });

    it('rejects a missing caseId', () => {
      expect(() => Trace.upload({ ...baseProps, caseId: '' })).toThrow();
    });

    it('carries the number allocated to it in the case', () => {
      expect(Trace.upload(baseProps).number).toBe(3);
      expect(Trace.upload(baseProps).toPrimitives().number).toBe(3);
    });

    it('rejects a missing number', () => {
      expect(() =>
        Trace.upload({ ...baseProps, number: undefined as unknown as number }),
      ).toThrow();
    });

    it('rejects a number below one', () => {
      expect(() => Trace.upload({ ...baseProps, number: 0 })).toThrow();
    });
  });

  describe('assertCaseCanReceiveTrace', () => {
    it.each(['OPEN', 'IN_PROGRESS', 'UNDER_REVIEW'])(
      'accepts a case in %s status',
      (status) => {
        expect(() =>
          Trace.assertCaseCanReceiveTrace('case-9', status),
        ).not.toThrow();
      },
    );

    it('rejects a case whose status is unknown (null)', () => {
      expect(() => Trace.assertCaseCanReceiveTrace('case-9', null)).toThrow(
        CaseUnavailableForTraceError,
      );
    });

    it('rejects a closed case', () => {
      expect(() => Trace.assertCaseCanReceiveTrace('case-9', 'CLOSED')).toThrow(
        CaseNotOpenForWorkError,
      );
    });
  });

  describe('evaluate', () => {
    it('transitions to EXPLOITABLE when the score meets the threshold', () => {
      const trace = Trace.upload(baseProps);

      trace.evaluate(ExploitabilityScore.of(12));

      expect(trace.status).toBe(TraceStatusEnum.EXPLOITABLE);
      expect(trace.score).toBe(12);
    });

    it('transitions to NOT_EXPLOITABLE when the score is below the threshold', () => {
      const trace = Trace.upload(baseProps);

      trace.evaluate(ExploitabilityScore.of(5));

      expect(trace.status).toBe(TraceStatusEnum.NOT_EXPLOITABLE);
      expect(trace.score).toBe(5);
    });

    it('refuses to evaluate twice', () => {
      const trace = Trace.upload(baseProps);
      trace.evaluate(ExploitabilityScore.of(12));

      expect(() => trace.evaluate(ExploitabilityScore.of(20))).toThrow(
        InvalidTraceTransitionError,
      );
    });
  });

  describe('reconstitute', () => {
    it('rebuilds a trace from primitives', () => {
      const trace = Trace.reconstitute({
        id: 't-1',
        number: 3,
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.EXPLOITABLE,
        score: 18,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        displayableSha256: TEST_IMAGE_SHA256,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
        captureQuality: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });

      expect(trace.status).toBe(TraceStatusEnum.EXPLOITABLE);
      expect(trace.score).toBe(18);
      expect(trace.caseId).toBe('case-9');
      expect(trace.sha256).toBe(TEST_IMAGE_SHA256);
    });

    it('rebuilds a trace deposited before the seal existed', () => {
      const trace = Trace.reconstitute({
        id: 't-1',
        number: 3,
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: null,
        displayableSha256: null,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
        captureQuality: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });

      expect(trace.sha256).toBeNull();
    });

    it('rebuilds the capture quality check stored in the column', () => {
      const trace = Trace.reconstitute({
        id: 't-1',
        number: 3,
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: null,
        displayableSha256: null,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
        captureQuality: { blurScore: 128.4, passed: true },
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });

      expect(trace.captureQuality?.blurScore).toBe(128.4);
      expect(trace.captureQuality?.passed).toBe(true);
    });

    it('refuses a malformed quality column', () => {
      expect(() =>
        Trace.reconstitute({
          id: 't-1',
          number: 3,
          path: 'media/case-9/traces/t-1.png',
          status: TraceStatusEnum.RECEIVED,
          score: null,
          caseId: 'case-9',
          sha256: null,
          displayableSha256: null,
          captureWidth: null,
          captureHeight: null,
          capturedAt: null,
          captureOrientation: null,
          captureFocalLength: null,
          captureDeviceModel: null,
          captureQuality: { blurScore: 'flou', passed: true },
          withdrawnAt: null,
          withdrawalMotive: null,
          resolutionDpi: null,
        }),
      ).toThrow(InvalidCaptureQualityError);
    });

    it('refuses a stored seal that is not a SHA-256', () => {
      expect(() =>
        Trace.reconstitute({
          id: 't-1',
          number: 3,
          path: 'media/case-9/traces/t-1.png',
          status: TraceStatusEnum.RECEIVED,
          score: null,
          caseId: 'case-9',
          sha256: 'not-a-hash',
          displayableSha256: 'not-a-hash',
          captureWidth: null,
          captureHeight: null,
          capturedAt: null,
          captureOrientation: null,
          captureFocalLength: null,
          captureDeviceModel: null,
          captureQuality: null,
          withdrawnAt: null,
          withdrawalMotive: null,
          resolutionDpi: null,
        }),
      ).toThrow(InvalidFileDigestError);
    });
  });

  describe('toPrimitives', () => {
    it('emits the seal alongside the piece', () => {
      expect(Trace.upload(baseProps).toPrimitives()).toEqual({
        id: 't-1',
        number: 3,
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        displayableSha256: TEST_IMAGE_SHA256,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
        captureQuality: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });
    });

    it('rebuilds a legacy row that predates the capture columns', () => {
      const trace = Trace.reconstitute({
        id: 't-1',
        number: 3,
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: null,
        displayableSha256: null,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
        captureQuality: null,
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });

      expect(trace.captureMetadata.width).toBeUndefined();
      expect(trace.captureMetadata.capturedAt).toBeUndefined();
      expect(trace.captureMetadata.deviceModel).toBeUndefined();
    });

    it('survives a round-trip through the persisted primitives', () => {
      const trace = Trace.upload({
        ...baseProps,
        captureMetadata: CaptureMetadata.of({
          width: 3024,
          height: 4032,
          capturedAt: '2026-08-18T10:12:00.000Z',
          orientation: 6,
          focalLength: 6.86,
          deviceModel: 'iPhone 14 Pro',
        }),
        captureQuality: CaptureQuality.of({ blurScore: 128.4, passed: false }),
      });

      const rebuilt = Trace.reconstitute(trace.toPrimitives());

      expect(rebuilt.toPrimitives()).toEqual(trace.toPrimitives());
    });

    it('round-trips a calibrated resolution', () => {
      const trace = Trace.upload(baseProps);
      trace.calibrate(1207.34);

      const rebuilt = Trace.reconstitute(trace.toPrimitives());

      expect(rebuilt.resolutionDpi).toBe(1207.34);
    });
  });
  describe('calibrate', () => {
    it('starts uncalibrated', () => {
      expect(Trace.upload(baseProps).resolutionDpi).toBeNull();
    });

    it('sets the resolution in points per inch of the source image', () => {
      const trace = Trace.upload(baseProps);

      trace.calibrate(1207.34);

      expect(trace.resolutionDpi).toBe(1207.34);
    });

    it('replaces the previous value when recalibrated', () => {
      const trace = Trace.upload(baseProps);
      trace.calibrate(500);

      trace.calibrate(600);

      expect(trace.resolutionDpi).toBe(600);
    });

    it('refuses a resolution outside the accepted range', () => {
      const trace = Trace.upload(baseProps);

      expect(() => trace.calibrate(3)).toThrow(InvalidImageResolutionError);
      expect(trace.resolutionDpi).toBeNull();
    });
  });

  describe('withdrawal', () => {
    const withdrawnTrace = () => {
      const trace = Trace.upload(baseProps);
      trace.withdraw('DUPLICATE', WITHDRAWN_AT);
      return trace;
    };

    it('records the date and the motive of the withdrawal', () => {
      const trace = withdrawnTrace();

      expect(trace.isWithdrawn).toBe(true);
      expect(trace.withdrawnAt).toBe(WITHDRAWN_AT);
      expect(trace.toPrimitives()).toMatchObject({
        withdrawnAt: WITHDRAWN_AT,
        withdrawalMotive: 'DUPLICATE',
      });
    });

    it('refuses to withdraw a piece already out of the case', () => {
      const trace = withdrawnTrace();

      expect(() => trace.withdraw('MISFILED', WITHDRAWN_AT)).toThrow(
        AlreadyWithdrawnError,
      );
    });

    it('refuses a motive outside the closed list', () => {
      const trace = Trace.upload(baseProps);

      expect(() => trace.withdraw('PARCE_QUE', WITHDRAWN_AT)).toThrow(
        InvalidWithdrawalMotiveError,
      );
    });

    it('erases both columns when the piece comes back', () => {
      const trace = withdrawnTrace();

      trace.restore();

      expect(trace.isWithdrawn).toBe(false);
      expect(trace.toPrimitives()).toMatchObject({
        withdrawnAt: null,
        withdrawalMotive: null,
        resolutionDpi: null,
      });
    });

    it('refuses to restore a piece that never left', () => {
      expect(() => Trace.upload(baseProps).restore()).toThrow(
        NotWithdrawnError,
      );
    });
  });
});
