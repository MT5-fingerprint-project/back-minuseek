export enum TraceOriginEnum {
  DIGITAL = 'DIGITAL',
  PALMAR = 'PALMAR',
}

export class InvalidTraceOriginError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas une origine de trace valide`);
  }
}

export class TraceOrigin {
  private constructor(private readonly value: TraceOriginEnum) {}

  static from(raw: string): TraceOrigin {
    if (!Object.values(TraceOriginEnum).includes(raw as TraceOriginEnum)) {
      throw new InvalidTraceOriginError(raw);
    }
    return new TraceOrigin(raw as TraceOriginEnum);
  }

  static fromPersistence(stored: string | null): TraceOrigin | null {
    return stored === null ? null : TraceOrigin.from(stored);
  }

  getValue(): TraceOriginEnum {
    return this.value;
  }

  equals(other: TraceOrigin): boolean {
    return this.value === other.value;
  }
}
