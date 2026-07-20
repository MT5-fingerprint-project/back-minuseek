import { CaseUnavailableForTraceError } from '../errors/case-unavailable-for-trace.error';
import { InvalidTraceTransitionError } from '../errors/invalid-trace-transition.error';
import { ExploitabilityScore } from '../value-objects/exploitability-score.vo';
import { TraceStatusEnum } from '../value-objects/trace-status.vo';
import { Trace } from './trace';

describe('Trace', () => {
  const baseProps = {
    id: 't-1',
    path: 'media/case-9/traces/t-1.png',
    caseId: 'case-9',
  };

  describe('upload', () => {
    it('starts in RECEIVED status with no score', () => {
      const trace = Trace.upload(baseProps);

      expect(trace.id).toBe('t-1');
      expect(trace.status).toBe(TraceStatusEnum.RECEIVED);
      expect(trace.score).toBeNull();
      expect(trace.caseId).toBe('case-9');
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
      });

      expect(trace.status).toBe(TraceStatusEnum.EXPLOITABLE);
      expect(trace.score).toBe(18);
      expect(trace.caseId).toBe('case-9');
    });
  });
});
