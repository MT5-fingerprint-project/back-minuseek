export enum RevelationTechniqueEnum {
  OPTICAL_PROCESS = 'OPTICAL_PROCESS',
  FINGERPRINT_POWDER = 'FINGERPRINT_POWDER',
  DFO = 'DFO',
  NINHYDRIN = 'NINHYDRIN',
}

export class InvalidRevelationTechniqueError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas une technique de révélation valide`);
  }
}

export class RevelationTechnique {
  private constructor(private readonly value: RevelationTechniqueEnum) {}

  static from(raw: string): RevelationTechnique {
    if (
      !Object.values(RevelationTechniqueEnum).includes(
        raw as RevelationTechniqueEnum,
      )
    ) {
      throw new InvalidRevelationTechniqueError(raw);
    }
    return new RevelationTechnique(raw as RevelationTechniqueEnum);
  }

  static fromPersistence(stored: string | null): RevelationTechnique | null {
    return stored === null ? null : RevelationTechnique.from(stored);
  }

  getValue(): RevelationTechniqueEnum {
    return this.value;
  }

  equals(other: RevelationTechnique): boolean {
    return this.value === other.value;
  }
}
