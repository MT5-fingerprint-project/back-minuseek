import type {
  FingerprintLocation,
  FingerprintLocatorPort,
} from '../../application/ports/fingerprint-locator.port';

export class InMemoryFingerprintLocatorAdapter implements FingerprintLocatorPort {
  private readonly locations = new Map<string, FingerprintLocation>();

  setTrace(traceId: string, caseId: string): void {
    this.locations.set(traceId, { caseId, traceId });
  }

  setReferencePrint(referencePrintId: string, caseId: string): void {
    this.locations.set(referencePrintId, { caseId, traceId: null });
  }

  locate(fingerprintId: string): Promise<FingerprintLocation | null> {
    return Promise.resolve(this.locations.get(fingerprintId) ?? null);
  }
}
