import {
  InvalidTraceOriginError,
  TraceOrigin,
  TraceOriginEnum,
} from './trace-origin.vo';

describe('TraceOrigin', () => {
  it('accepts each origin of the closed vocabulary', () => {
    expect(TraceOrigin.from('DIGITAL').getValue()).toBe(
      TraceOriginEnum.DIGITAL,
    );
    expect(TraceOrigin.from('PALMAR').getValue()).toBe(TraceOriginEnum.PALMAR);
  });

  it('rejects an origin outside the vocabulary', () => {
    expect(() => TraceOrigin.from('PLANTAR')).toThrow(InvalidTraceOriginError);
  });

  it('reads an absent origin from persistence as no origin at all', () => {
    expect(TraceOrigin.fromPersistence(null)).toBeNull();
    expect(TraceOrigin.fromPersistence('PALMAR')?.getValue()).toBe(
      TraceOriginEnum.PALMAR,
    );
  });

  it('compares by value', () => {
    expect(
      TraceOrigin.from('DIGITAL').equals(TraceOrigin.from('DIGITAL')),
    ).toBe(true);
    expect(TraceOrigin.from('DIGITAL').equals(TraceOrigin.from('PALMAR'))).toBe(
      false,
    );
  });
});
