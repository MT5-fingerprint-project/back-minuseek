import { assignCotes, coteForRank } from './cote';

const EXPLOITABLE = 'EXPLOITABLE';
const NOT_EXPLOITABLE = 'NOT_EXPLOITABLE';
const RECEIVED = 'RECEIVED';

describe('coteForRank', () => {
  it('donne les lettres de A à Z aux vingt-six premiers rangs', () => {
    expect(coteForRank(1)).toBe('A');
    expect(coteForRank(2)).toBe('B');
    expect(coteForRank(26)).toBe('Z');
  });

  it('continue en AA, AB au-delà de vingt-six', () => {
    expect(coteForRank(27)).toBe('AA');
    expect(coteForRank(28)).toBe('AB');
  });

  it('passe de AZ à BA, puis de ZZ à AAA', () => {
    expect(coteForRank(52)).toBe('AZ');
    expect(coteForRank(53)).toBe('BA');
    expect(coteForRank(702)).toBe('ZZ');
    expect(coteForRank(703)).toBe('AAA');
  });
});

describe('assignCotes', () => {
  const REFERENCE_CASE = [
    { number: 1, status: EXPLOITABLE },
    { number: 2, status: EXPLOITABLE },
    { number: 3, status: NOT_EXPLOITABLE },
    { number: 4, status: NOT_EXPLOITABLE },
    { number: 5, status: NOT_EXPLOITABLE },
    { number: 6, status: EXPLOITABLE },
    { number: 7, status: EXPLOITABLE },
    { number: 8, status: EXPLOITABLE },
    { number: 9, status: EXPLOITABLE },
    { number: 10, status: EXPLOITABLE },
    { number: 11, status: EXPLOITABLE },
  ];

  it('cote les seules traces exploitables, dans l’ordre de leur numéro', () => {
    const cotes = assignCotes(REFERENCE_CASE);

    expect([...cotes.entries()]).toEqual([
      [1, 'A'],
      [2, 'B'],
      [6, 'C'],
      [7, 'D'],
      [8, 'E'],
      [9, 'F'],
      [10, 'G'],
      [11, 'H'],
    ]);
  });

  it('ne laisse aucun trou dans la suite des lettres', () => {
    const cotes = assignCotes(REFERENCE_CASE);

    expect([...cotes.values()]).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ]);
  });

  it('fait remonter les suivantes quand une trace est requalifiée', () => {
    const requalified = REFERENCE_CASE.map((trace) =>
      trace.number === 2 ? { ...trace, status: NOT_EXPLOITABLE } : trace,
    );

    const cotes = assignCotes(requalified);

    expect(cotes.get(2)).toBeUndefined();
    expect(cotes.get(6)).toBe('B');
    expect(cotes.get(11)).toBe('G');
  });

  it('ne cote pas une trace qui n’a pas encore été déclarée', () => {
    const cotes = assignCotes([
      { number: 1, status: RECEIVED },
      { number: 2, status: EXPLOITABLE },
    ]);

    expect(cotes.get(1)).toBeUndefined();
    expect(cotes.get(2)).toBe('A');
  });

  it('suit les numéros et non l’ordre de la liste reçue', () => {
    const cotes = assignCotes([
      { number: 3, status: EXPLOITABLE },
      { number: 1, status: EXPLOITABLE },
      { number: 2, status: EXPLOITABLE },
    ]);

    expect(cotes.get(1)).toBe('A');
    expect(cotes.get(2)).toBe('B');
    expect(cotes.get(3)).toBe('C');
  });

  it('continue en AA au-delà de vingt-six traces exploitables', () => {
    const traces = Array.from({ length: 27 }, (_, index) => ({
      number: index + 1,
      status: EXPLOITABLE,
    }));

    expect(assignCotes(traces).get(27)).toBe('AA');
  });

  it('ne cote rien dans une affaire sans trace', () => {
    expect(assignCotes([]).size).toBe(0);
  });
});
