export enum TraceStatusEnum {
  RECEIVED = 'RECEIVED',
  EXPLOITABLE = 'EXPLOITABLE',
  NOT_EXPLOITABLE = 'NOT_EXPLOITABLE',
}

export class InvalidTraceStatusError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un statut valide`);
  }
}

export class TraceStatus {
  private constructor(private readonly value: TraceStatusEnum) {}

  static from(raw: string): TraceStatus {
    if (!Object.values(TraceStatusEnum).includes(raw as TraceStatusEnum)) {
      throw new InvalidTraceStatusError(raw);
    }
    return new TraceStatus(raw as TraceStatusEnum);
  }

  static received(): TraceStatus {
    return new TraceStatus(TraceStatusEnum.RECEIVED);
  }

  static exploitable(): TraceStatus {
    return new TraceStatus(TraceStatusEnum.EXPLOITABLE);
  }

  static notExploitable(): TraceStatus {
    return new TraceStatus(TraceStatusEnum.NOT_EXPLOITABLE);
  }

  getValue(): TraceStatusEnum {
    return this.value;
  }

  equals(other: TraceStatus): boolean {
    return this.value === other.value;
  }
}
