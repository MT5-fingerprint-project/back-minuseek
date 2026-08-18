import { FileDigest, InvalidFileDigestError } from '../../file-digest.vo';
import { CaseUnavailableForTraceError } from '../errors/case-unavailable-for-trace.error';
import { InvalidTraceTransitionError } from '../errors/invalid-trace-transition.error';
import { CaptureMetadata } from '../value-objects/capture-metadata.vo';
import { ExploitabilityScore } from '../value-objects/exploitability-score.vo';
import { TraceStatusEnum } from '../value-objects/trace-status.vo';
import { Trace } from './trace';

const TEST_IMAGE_SHA256 =
  '9febe01bd41bfb69683e29d711d8adffc9ae38de17a6873464b416f3b67398b6';

describe('Trace', () => {
  const baseProps = {
    id: 't-1',
    path: 'media/case-9/traces/t-1.png',
    caseId: 'case-9',
    sha256: FileDigest.ofBuffer(Buffer.from('test-image')),
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
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
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
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        captureWidth: 3024,
        captureHeight: 4032,
        capturedAt: new Date('2026-08-18T10:12:00.000Z'),
        captureOrientation: 6,
        captureFocalLength: 6.86,
        captureDeviceModel: 'iPhone 14 Pro',
      });
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
  });

  describe('assertCaseCanReceiveTrace', () => {
    it.each(['OPEN', 'IN_PROGRESS'])(
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

    it.each(['CLOSED', 'UNDER_REVIEW'])(
      'rejects a case in %s status',
      (status) => {
        expect(() => Trace.assertCaseCanReceiveTrace('case-9', status)).toThrow(
          CaseUnavailableForTraceError,
        );
      },
    );
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
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.EXPLOITABLE,
        score: 18,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
      });

      expect(trace.status).toBe(TraceStatusEnum.EXPLOITABLE);
      expect(trace.score).toBe(18);
      expect(trace.caseId).toBe('case-9');
      expect(trace.sha256).toBe(TEST_IMAGE_SHA256);
    });

    it('rebuilds a trace deposited before the seal existed', () => {
      const trace = Trace.reconstitute({
        id: 't-1',
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: null,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
      });

      expect(trace.sha256).toBeNull();
    });

    it('refuses a stored seal that is not a SHA-256', () => {
      expect(() =>
        Trace.reconstitute({
          id: 't-1',
          path: 'media/case-9/traces/t-1.png',
          status: TraceStatusEnum.RECEIVED,
          score: null,
          caseId: 'case-9',
          sha256: 'not-a-hash',
          captureWidth: null,
          captureHeight: null,
          capturedAt: null,
          captureOrientation: null,
          captureFocalLength: null,
          captureDeviceModel: null,
        }),
      ).toThrow(InvalidFileDigestError);
    });
  });

  describe('toPrimitives', () => {
    it('emits the seal alongside the piece', () => {
      expect(Trace.upload(baseProps).toPrimitives()).toEqual({
        id: 't-1',
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: TEST_IMAGE_SHA256,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
      });
    });

    it('rebuilds a legacy row that predates the capture columns', () => {
      const trace = Trace.reconstitute({
        id: 't-1',
        path: 'media/case-9/traces/t-1.png',
        status: TraceStatusEnum.RECEIVED,
        score: null,
        caseId: 'case-9',
        sha256: null,
        captureWidth: null,
        captureHeight: null,
        capturedAt: null,
        captureOrientation: null,
        captureFocalLength: null,
        captureDeviceModel: null,
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
      });

      const rebuilt = Trace.reconstitute(trace.toPrimitives());

      expect(rebuilt.toPrimitives()).toEqual(trace.toPrimitives());
    });
  });
});
