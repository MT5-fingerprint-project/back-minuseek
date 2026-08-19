export interface FingerprintLocation {
  caseId: string;
  traceId: string | null;
}

export interface FingerprintLocatorPort {
  locate(fingerprintId: string): Promise<FingerprintLocation | null>;
}

export const FINGERPRINT_LOCATOR = 'FingerprintLocator';
