const NUMERALS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(rank: number): string {
  if (!Number.isInteger(rank) || rank < 1 || rank > 3999) {
    return String(rank);
  }
  let left = rank;
  let written = '';
  for (const [value, numeral] of NUMERALS) {
    while (left >= value) {
      written += numeral;
      left -= value;
    }
  }
  return written;
}
