export enum EvidenceClassEnum {
  // backend witness this is an evidence that has been observed by the system
  OBSERVED = 'OBSERVED',
  // event that has been declared by client but not yet observed by the system
  DECLARED = 'DECLARED',
}

export class InvalidEvidenceClassError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas une classe de preuve valide`);
  }
}

function isEvidenceClass(raw: string): raw is EvidenceClassEnum {
  return (Object.values(EvidenceClassEnum) as string[]).includes(raw);
}

export class EvidenceClass {
  private constructor(private readonly value: EvidenceClassEnum) {}

  static from(raw: string): EvidenceClass {
    if (!isEvidenceClass(raw)) {
      throw new InvalidEvidenceClassError(raw);
    }
    return new EvidenceClass(raw);
  }

  static observed(): EvidenceClass {
    return new EvidenceClass(EvidenceClassEnum.OBSERVED);
  }

  static declared(): EvidenceClass {
    return new EvidenceClass(EvidenceClassEnum.DECLARED);
  }

  getValue(): EvidenceClassEnum {
    return this.value;
  }

  equals(other: EvidenceClass): boolean {
    return this.value === other.value;
  }
}
