export interface FingerprintMatchCandidate {
  referencePrintId: string;
  score: number;
}

export interface CompareFingerprintsInput {
  caseId: string;
  traceId: string;
  referencePrintIds: string[];
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
