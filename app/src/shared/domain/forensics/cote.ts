const EXPLOITABLE = 'EXPLOITABLE';
const ALPHABET_LENGTH = 26;
const FIRST_LETTER = 'A'.charCodeAt(0);

export interface CotableTrace {
  number: number;
  status: string;
}

export function coteForRank(rank: number): string {
  let cote = '';
  let remaining = rank;
  while (remaining > 0) {
    const letter = (remaining - 1) % ALPHABET_LENGTH;
    cote = String.fromCharCode(FIRST_LETTER + letter) + cote;
    remaining = Math.floor((remaining - 1) / ALPHABET_LENGTH);
  }
  return cote;
}

export function assignCotes(traces: CotableTrace[]): Map<number, string> {
  const cotes = new Map<number, string>();
  const ordered = [...traces].sort((left, right) => left.number - right.number);
  for (const trace of ordered) {
    if (trace.status === EXPLOITABLE) {
      cotes.set(trace.number, coteForRank(cotes.size + 1));
    }
  }
  return cotes;
}
