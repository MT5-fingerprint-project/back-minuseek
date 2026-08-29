export const MIN_RESOLUTION_DPI = 50;
export const MAX_RESOLUTION_DPI = 10_000;

export class InvalidImageResolutionError extends Error {
  constructor(value: number) {
    super(
      `"${value}" n'est pas une résolution plausible : attendu entre ${MIN_RESOLUTION_DPI} et ${MAX_RESOLUTION_DPI} points par pouce`,
    );
  }
}

export class ImageResolution {
  private constructor(private readonly value: number) {}

  static of(dpi: number): ImageResolution {
    if (
      !Number.isFinite(dpi) ||
      dpi < MIN_RESOLUTION_DPI ||
      dpi > MAX_RESOLUTION_DPI
    ) {
      throw new InvalidImageResolutionError(dpi);
    }
    return new ImageResolution(dpi);
  }

  static fromPersistence(stored: number | null): ImageResolution | null {
    return stored === null ? null : ImageResolution.of(stored);
  }

  getValue(): number {
    return this.value;
  }

  equals(other: ImageResolution): boolean {
    return this.value === other.value;
  }
}
