import { InvalidTraceTransitionError } from './errors/invalid-trace-transition.error';
import { ExploitabilityScore } from './exploitability-score';
import { Trace } from './trace';
import { TraceStatus } from './trace-status';

describe('Trace', () => {
  describe('upload', () => {
    it('starts in RECEIVED status with no score', () => {
      const trace = Trace.upload({ id: 't-1', path: 'media/traces/t-1.png' });

      expect(trace.id).toBe('t-1');
      expect(trace.status).toBe(TraceStatus.RECEIVED);
      expect(trace.score).toBeNull();
      expect(trace.caseId).toBeNull();
    });

    it('attaches an optional caseId', () => {
      const trace = Trace.upload({
        id: 't-1',
        path: 'media/traces/t-1.png',
        caseId: 'case-9',
      });

      expect(trace.caseId).toBe('case-9');
    });

    it('rejects an empty id', () => {
      expect(() =>
        Trace.upload({ id: '', path: 'media/traces/t-1.png' }),
      ).toThrow();
    });

    it('rejects an empty path', () => {
      expect(() => Trace.upload({ id: 't-1', path: '' })).toThrow();
    });
  });

  describe('evaluate', () => {
    it('transitions to EXPLOITABLE when the score meets the threshold', () => {
      const trace = Trace.upload({ id: 't-1', path: 'media/traces/t-1.png' });

      trace.evaluate(ExploitabilityScore.of(12));

      expect(trace.status).toBe(TraceStatus.EXPLOITABLE);
      expect(trace.score?.toPrimitive()).toBe(12);
    });

    it('transitions to NOT_EXPLOITABLE when the score is below the threshold', () => {
      const trace = Trace.upload({ id: 't-1', path: 'media/traces/t-1.png' });

      trace.evaluate(ExploitabilityScore.of(5));

      expect(trace.status).toBe(TraceStatus.NOT_EXPLOITABLE);
      expect(trace.score?.toPrimitive()).toBe(5);
    });

    it('refuses to evaluate twice', () => {
      const trace = Trace.upload({ id: 't-1', path: 'media/traces/t-1.png' });
      trace.evaluate(ExploitabilityScore.of(12));

      expect(() => trace.evaluate(ExploitabilityScore.of(20))).toThrow(
        InvalidTraceTransitionError,
      );
    });
  });

  describe('reconstitute', () => {
    it('rebuilds a trace with its persisted score wrapped in a value object', () => {
      const trace = Trace.reconstitute({
        id: 't-1',
        path: 'media/traces/t-1.png',
        status: TraceStatus.EXPLOITABLE,
        score: 18,
        caseId: 'case-9',
      });

      expect(trace.status).toBe(TraceStatus.EXPLOITABLE);
      expect(trace.score?.toPrimitive()).toBe(18);
      expect(trace.caseId).toBe('case-9');
    });
  });
});
