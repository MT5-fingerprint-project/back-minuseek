import { Hit } from './hit';
import { REQUIRED_MINUTIAE } from '../hit-rules';
import { InsufficientMinutiaeError } from '../errors/insufficient-minutiae.error';

describe('Hit', () => {
  const props = {
    id: 'hit-1',
    traceId: 'trace-1',
    referencePrintId: 'ref-1',
    traceMinutiae: REQUIRED_MINUTIAE,
    referenceMinutiae: REQUIRED_MINUTIAE,
  };

  it('records a hit when both sides carry enough minutiae', () => {
    const hit = Hit.record({ ...props, declaredByUserId: 'user-1' });

    expect(hit.id).toBe('hit-1');
    expect(hit.traceId).toBe('trace-1');
    expect(hit.referencePrintId).toBe('ref-1');
    expect(hit.declaredByUserId).toBe('user-1');
  });

  it('defaults declaredByUserId to null when not provided', () => {
    expect(Hit.record(props).declaredByUserId).toBeNull();
  });

  it('rejects when the trace lacks minutiae', () => {
    expect(() =>
      Hit.record({ ...props, traceMinutiae: REQUIRED_MINUTIAE - 1 }),
    ).toThrow(InsufficientMinutiaeError);
  });

  it('rejects when the reference print lacks minutiae', () => {
    expect(() =>
      Hit.record({ ...props, referenceMinutiae: REQUIRED_MINUTIAE - 1 }),
    ).toThrow(expect.objectContaining({ side: 'reference-print' }) as Error);
  });

  it('reconstitutes from primitives without re-checking minutiae', () => {
    const primitives = {
      id: 'hit-1',
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      declaredByUserId: 'user-1',
    };

    expect(Hit.fromPrimitives(primitives).toPrimitives()).toEqual(primitives);
  });
});
