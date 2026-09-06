export const MIN_MARK_RADIUS = 2;
export const MAX_MARK_RADIUS = 2000;

export class InvalidMarkRadiusError extends Error {
  constructor(value: number) {
    super(
      `"${value}" n'est pas une taille de repère plausible : attendu un entier entre ${MIN_MARK_RADIUS} et ${MAX_MARK_RADIUS} pixels`,
    );
  }
}

export class MarkRadius {
  private constructor(private readonly value: number) {}

  static of(pixels: number): MarkRadius {
    if (
      !Number.isInteger(pixels) ||
      pixels < MIN_MARK_RADIUS ||
      pixels > MAX_MARK_RADIUS
    ) {
      throw new InvalidMarkRadiusError(pixels);
    }
    return new MarkRadius(pixels);
  }

  static fromPersistence(stored: number | null): MarkRadius | null {
    return stored === null ? null : MarkRadius.of(stored);
  }

  getValue(): number {
    return this.value;
  }

  equals(other: MarkRadius): boolean {
    return this.value === other.value;
  }
}
