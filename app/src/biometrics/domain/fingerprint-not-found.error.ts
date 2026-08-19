export class FingerprintNotFoundError extends Error {
  constructor(fingerprintId: string) {
    super(`Fingerprint ${fingerprintId} not found`);
  }
}
