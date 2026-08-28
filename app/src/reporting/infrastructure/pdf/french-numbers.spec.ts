import { frenchCardinal } from './french-numbers';

describe('frenchCardinal', () => {
  it.each([
    [0, 'ZÉRO'],
    [1, 'UN'],
    [9, 'NEUF'],
    [12, 'DOUZE'],
    [17, 'DIX-SEPT'],
    [21, 'VINGT ET UN'],
    [24, 'VINGT-QUATRE'],
    [70, 'SOIXANTE-DIX'],
    [71, 'SOIXANTE ET ONZE'],
    [80, 'QUATRE-VINGTS'],
    [81, 'QUATRE-VINGT-UN'],
    [91, 'QUATRE-VINGT-ONZE'],
    [100, 'CENT'],
    [120, 'CENT VINGT'],
    [999, 'NEUF CENT QUATRE-VINGT-DIX-NEUF'],
  ])('écrit %i en toutes lettres', (value, expected) => {
    expect(frenchCardinal(value)).toBe(expected);
  });

  it('rend les chiffres au-delà de neuf cent quatre-vingt-dix-neuf', () => {
    expect(frenchCardinal(1000)).toBe('1000');
  });

  it('rend les chiffres pour ce qui ne se dit pas', () => {
    expect(frenchCardinal(-1)).toBe('-1');
    expect(frenchCardinal(2.5)).toBe('2.5');
  });

  it('accorde le pluriel de vingt et de cent seulement quand rien ne suit', () => {
    expect(frenchCardinal(200)).toBe('DEUX CENTS');
    expect(frenchCardinal(201)).toBe('DEUX CENT UN');
    expect(frenchCardinal(82)).toBe('QUATRE-VINGT-DEUX');
  });
});
