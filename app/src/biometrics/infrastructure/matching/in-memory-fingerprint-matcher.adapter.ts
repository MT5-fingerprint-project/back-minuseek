import {
  CompareFingerprintsInput,
  FingerprintComparison,
  FingerprintMatchCandidate,
  FingerprintMatcherPort,
} from '../../application/ports/fingerprint-matcher.port';

export class InMemoryFingerprintMatcherAdapter implements FingerprintMatcherPort {
  private results: FingerprintMatchCandidate[] = [];
  private engineVersion: string | null = 'sourceafis-3.17.1+minuseek.1';
  public lastInput: CompareFingerprintsInput | undefined;

  setResults(results: FingerprintMatchCandidate[]): void {
    this.results = results;
  }

  setEngineVersion(engineVersion: string | null): void {
    this.engineVersion = engineVersion;
  }

  compare(input: CompareFingerprintsInput): Promise<FingerprintComparison> {
    this.lastInput = input;
    return Promise.resolve({
      candidates: this.results,
      engineVersion: this.engineVersion,
    });
  }
}
