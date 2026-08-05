export enum SexEnum {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export class InvalidSexError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un sexe valide`);
  }
}

export class Sex {
  private constructor(private readonly value: SexEnum) {}

  static from(raw: string): Sex {
    if (!Object.values(SexEnum).includes(raw as SexEnum)) {
      throw new InvalidSexError(raw);
    }
    return new Sex(raw as SexEnum);
  }

  static male(): Sex {
    return new Sex(SexEnum.MALE);
  }

  static female(): Sex {
    return new Sex(SexEnum.FEMALE);
  }

  getValue(): SexEnum {
    return this.value;
  }

  equals(other: Sex): boolean {
    return this.value === other.value;
  }
}
