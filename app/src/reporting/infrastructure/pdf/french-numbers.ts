const UNITS = [
  'ZÉRO',
  'UN',
  'DEUX',
  'TROIS',
  'QUATRE',
  'CINQ',
  'SIX',
  'SEPT',
  'HUIT',
  'NEUF',
  'DIX',
  'ONZE',
  'DOUZE',
  'TREIZE',
  'QUATORZE',
  'QUINZE',
  'SEIZE',
  'DIX-SEPT',
  'DIX-HUIT',
  'DIX-NEUF',
];

const TENS: Record<number, string> = {
  2: 'VINGT',
  3: 'TRENTE',
  4: 'QUARANTE',
  5: 'CINQUANTE',
  6: 'SOIXANTE',
  8: 'QUATRE-VINGT',
};

const MAX_SPELLED = 999;

function belowHundred(value: number): string {
  if (value < 20) {
    return UNITS[value];
  }
  const tensDigit =
    value >= 70 && value < 80 ? 6 : value >= 90 ? 8 : Math.floor(value / 10);
  const rest = value - tensDigit * 10;
  const tensWord = TENS[tensDigit];

  if (rest === 0) {
    return tensDigit === 8 ? 'QUATRE-VINGTS' : tensWord;
  }
  if ((rest === 1 || rest === 11) && tensDigit !== 8) {
    return `${tensWord} ET ${UNITS[rest]}`;
  }
  return `${tensWord}-${UNITS[rest]}`;
}

function belowThousand(value: number): string {
  if (value < 100) {
    return belowHundred(value);
  }
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const prefix = hundreds === 1 ? 'CENT' : `${UNITS[hundreds]} CENT`;

  if (rest === 0) {
    return hundreds === 1 ? 'CENT' : `${prefix}S`;
  }
  return `${prefix} ${belowHundred(rest)}`;
}

export function frenchCardinal(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SPELLED) {
    return String(value);
  }
  return belowThousand(value);
}
