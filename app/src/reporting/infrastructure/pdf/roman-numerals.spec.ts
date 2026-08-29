import { toRoman } from './roman-numerals';

describe('toRoman', () => {
  it.each([
    [1, 'I'],
    [2, 'II'],
    [3, 'III'],
    [4, 'IV'],
    [5, 'V'],
    [9, 'IX'],
    [10, 'X'],
    [14, 'XIV'],
    [40, 'XL'],
    [49, 'XLIX'],
    [90, 'XC'],
    [100, 'C'],
    [400, 'CD'],
    [900, 'CM'],
    [1000, 'M'],
    [1987, 'MCMLXXXVII'],
    [3999, 'MMMCMXCIX'],
  ])('numérote la planche %i « %s »', (value, expected) => {
    expect(toRoman(value)).toBe(expected);
  });

  it.each([0, -1, 1.5, 4000])(
    'rend les chiffres pour %p, qui n’est pas un rang de planche',
    (value) => {
      expect(toRoman(value)).toBe(String(value));
    },
  );
});
