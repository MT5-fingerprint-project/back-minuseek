import {
  CompareFingerprintsInput,
  FingerprintMatchCandidate,
  FingerprintMatcherPort,
} from '../../application/ports/fingerprint-matcher.port';

export class InMemoryFingerprintMatcherAdapter implements FingerprintMatcherPort {
  private results: FingerprintMatchCandidate[] = [];
  public lastInput: CompareFingerprintsInput | undefined;

  setResults(results: FingerprintMatchCandidate[]): void {
    this.results = results;
  }

  compare(
    input: CompareFingerprintsInput,
  ): Promise<FingerprintMatchCandidate[]> {
    this.lastInput = input;
    return Promise.resolve(this.results);
  }
}
