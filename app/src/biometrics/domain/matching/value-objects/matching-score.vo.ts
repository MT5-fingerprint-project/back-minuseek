// Score SourceAFIS au-delà duquel deux empreintes sont considérées comme correspondantes.
// Seule source de vérité du verdict de match : data renvoie un score brut, le front consomme le verdict.
const MATCH_THRESHOLD = 40;

export class MatchingScore {
  private constructor(private readonly value: number) {}

  static of(value: number): MatchingScore {
    if (!Number.isFinite(value)) {
      throw new Error('MatchingScore must be a finite number');
    }
    if (value < 0) {
      throw new Error('MatchingScore cannot be negative');
    }
    return new MatchingScore(value);
  }

  isMatch(): boolean {
    return this.value >= MATCH_THRESHOLD;
  }

  getValue(): number {
    return this.value;
  }

  equals(other: MatchingScore): boolean {
    return this.value === other.value;
  }
}
