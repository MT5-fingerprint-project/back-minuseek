import { MinutiaPair, type MinutiaPairPrimitives } from './minutia-pair';

const PRIMITIVES: MinutiaPairPrimitives = {
  id: 'pair-1',
  traceId: 'trace-1',
  referencePrintId: 'ref-1',
  traceMinutiaLayerId: 'layer-trace-1',
  referenceMinutiaLayerId: 'layer-ref-1',
  createdByUserId: 'user-marie',
  createdAt: new Date('2026-09-01T10:00:00Z'),
};

describe('MinutiaPair', () => {
  it('gives back exactly what it was built from', () => {
    expect(MinutiaPair.fromPrimitives(PRIMITIVES).toPrimitives()).toEqual(
      PRIMITIVES,
    );
  });

  it('exposes both sides of the pair and its author', () => {
    const pair = MinutiaPair.fromPrimitives(PRIMITIVES);

    expect([
      pair.id,
      pair.traceId,
      pair.referencePrintId,
      pair.traceMinutiaLayerId,
      pair.referenceMinutiaLayerId,
      pair.createdByUserId,
    ]).toEqual([
      'pair-1',
      'trace-1',
      'ref-1',
      'layer-trace-1',
      'layer-ref-1',
      'user-marie',
    ]);
  });

  it('accepts a pair posed by nobody in particular', () => {
    expect(
      MinutiaPair.fromPrimitives({ ...PRIMITIVES, createdByUserId: null })
        .createdByUserId,
    ).toBeNull();
  });

  it('cannot be back-dated through the date it was built from', () => {
    const createdAt = new Date('2026-09-01T10:00:00Z');
    const pair = MinutiaPair.fromPrimitives({ ...PRIMITIVES, createdAt });

    createdAt.setFullYear(1980);

    expect(pair.createdAt).toEqual(new Date('2026-09-01T10:00:00Z'));
  });

  it('cannot be back-dated through the date it gives out', () => {
    const pair = MinutiaPair.fromPrimitives(PRIMITIVES);

    pair.createdAt.setFullYear(1980);

    expect(pair.toPrimitives().createdAt).toEqual(
      new Date('2026-09-01T10:00:00Z'),
    );
  });
});
