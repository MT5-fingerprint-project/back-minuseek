export interface FingerprintMatchCandidate {
  referencePrintId: string;
  score: number;
}

export interface CompareFingerprintsInput {
  caseId: string;
  traceId: string;
  referencePrintIds: string[];
  /** DPI issus de la calibration au réglet ; null si l'image n'est pas calibrée. */
  traceDpi: number | null;
  referencePrintDpis: Record<string, number | null>;
}

export interface FingerprintComparison {
  candidates: FingerprintMatchCandidate[];
  /** Version du moteur qui a produit ces scores ; null si data ne la donne pas. */
  engineVersion: string | null;
}

export interface FingerprintMatcherPort {
  compare(input: CompareFingerprintsInput): Promise<FingerprintComparison>;
}

export const FINGERPRINT_MATCHER = 'FingerprintMatcher';
