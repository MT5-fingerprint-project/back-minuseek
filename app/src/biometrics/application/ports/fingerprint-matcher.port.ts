export interface FingerprintMatchCandidate {
  referencePrintId: string;
  score: number;
}

export interface CompareFingerprintsInput {
  caseId: string;
  traceId: string;
  referencePrintIds: string[];
}

export interface FingerprintMatcherPort {
  compare(
    input: CompareFingerprintsInput,
  ): Promise<FingerprintMatchCandidate[]>;
}

export const FINGERPRINT_MATCHER = 'FingerprintMatcher';
