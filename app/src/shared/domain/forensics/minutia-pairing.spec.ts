import { MinutiaTypeEnum } from './minutiae';
import { numberMinutiaPairs, resolvePairType } from './minutia-pairing';

const DETERMINED_TYPES = Object.values(MinutiaTypeEnum).filter(
  (type) => type !== MinutiaTypeEnum.UNDETERMINED,
);

describe('numberMinutiaPairs', () => {
  const pair = (id: string, createdAt: string) => ({
    id,
    createdAt: new Date(createdAt),
  });

  it('numbers a single pair from one', () => {
    expect(numberMinutiaPairs([pair('a', '2026-09-01T10:00:00Z')])).toEqual([
      { id: 'a', createdAt: new Date('2026-09-01T10:00:00Z'), number: 1 },
    ]);
  });

  it('returns nothing for an empty list', () => {
    expect(numberMinutiaPairs([])).toEqual([]);
  });

  it('numbers by increasing creation date, whatever the input order', () => {
    const numbered = numberMinutiaPairs([
      pair('c', '2026-09-01T12:00:00Z'),
      pair('a', '2026-09-01T10:00:00Z'),
      pair('b', '2026-09-01T11:00:00Z'),
    ]);

    expect(numbered.map((entry) => [entry.id, entry.number])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('breaks a tie on the creation date by increasing identifier', () => {
    const sameInstant = '2026-09-01T10:00:00Z';

    const numbered = numberMinutiaPairs([
      pair('b', sameInstant),
      pair('a', sameInstant),
      pair('c', sameInstant),
    ]);

    expect(numbered.map((entry) => [entry.id, entry.number])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('keeps every other field of the numbered rows', () => {
    const numbered = numberMinutiaPairs([
      {
        ...pair('a', '2026-09-01T10:00:00Z'),
        traceMinutiaLayerId: 'trace-minutia-1',
      },
    ]);

    expect(numbered[0].traceMinutiaLayerId).toBe('trace-minutia-1');
  });

  it('leaves the given list untouched', () => {
    const given = [
      pair('c', '2026-09-01T12:00:00Z'),
      pair('a', '2026-09-01T10:00:00Z'),
    ];

    numberMinutiaPairs(given);

    expect(given.map((entry) => entry.id)).toEqual(['c', 'a']);
  });

  it('gives the same numbers when applied to its own result', () => {
    const once = numberMinutiaPairs([
      pair('c', '2026-09-01T12:00:00Z'),
      pair('a', '2026-09-01T10:00:00Z'),
    ]);

    expect(numberMinutiaPairs(once)).toEqual(once);
  });
});

describe('resolvePairType', () => {
  it('pairs two identical determined types', () => {
    expect(
      resolvePairType(MinutiaTypeEnum.BIFURCATION, MinutiaTypeEnum.BIFURCATION),
    ).toEqual({ outcome: 'PAIRED', type: MinutiaTypeEnum.BIFURCATION });
  });

  it.each(DETERMINED_TYPES)('pairs two %s minutiae', (type) => {
    expect(resolvePairType(type, type)).toEqual({ outcome: 'PAIRED', type });
  });

  it('pairs two undetermined minutiae without qualifying anything', () => {
    expect(
      resolvePairType(
        MinutiaTypeEnum.UNDETERMINED,
        MinutiaTypeEnum.UNDETERMINED,
      ),
    ).toEqual({ outcome: 'PAIRED', type: MinutiaTypeEnum.UNDETERMINED });
  });

  it('qualifies the reference side when only the trace is determined', () => {
    expect(
      resolvePairType(MinutiaTypeEnum.ISLAND, MinutiaTypeEnum.UNDETERMINED),
    ).toEqual({
      outcome: 'QUALIFIES',
      type: MinutiaTypeEnum.ISLAND,
      sideToQualify: 'REFERENCE',
    });
  });

  it('qualifies the trace side when only the reference is determined', () => {
    expect(
      resolvePairType(MinutiaTypeEnum.UNDETERMINED, MinutiaTypeEnum.ENCLOSURE),
    ).toEqual({
      outcome: 'QUALIFIES',
      type: MinutiaTypeEnum.ENCLOSURE,
      sideToQualify: 'TRACE',
    });
  });

  it('refuses two different determined types, naming both sides', () => {
    expect(
      resolvePairType(
        MinutiaTypeEnum.RIDGE_ENDING,
        MinutiaTypeEnum.TRIFURCATION,
      ),
    ).toEqual({
      outcome: 'REFUSED',
      traceType: MinutiaTypeEnum.RIDGE_ENDING,
      referenceType: MinutiaTypeEnum.TRIFURCATION,
    });
  });

  it('refuses the same disagreement whichever side is read first', () => {
    expect(
      resolvePairType(
        MinutiaTypeEnum.TRIFURCATION,
        MinutiaTypeEnum.RIDGE_ENDING,
      ).outcome,
    ).toBe('REFUSED');
  });
});
