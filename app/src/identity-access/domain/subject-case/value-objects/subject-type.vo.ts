export enum SubjectTypeEnum {
  KNOWN_ASSOCIATE = 'KNOWN_ASSOCIATE',
  SUSPECT = 'SUSPECT',
}

export class InvalidSubjectTypeError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un type de sujet valide`);
  }
}

export class SubjectType {
  private constructor(private readonly value: SubjectTypeEnum) {}

  static from(raw: string): SubjectType {
    if (!Object.values(SubjectTypeEnum).includes(raw as SubjectTypeEnum)) {
      throw new InvalidSubjectTypeError(raw);
    }
    return new SubjectType(raw as SubjectTypeEnum);
  }

  static knownAssociate(): SubjectType {
    return new SubjectType(SubjectTypeEnum.KNOWN_ASSOCIATE);
  }

  static suspect(): SubjectType {
    return new SubjectType(SubjectTypeEnum.SUSPECT);
  }

  getValue(): SubjectTypeEnum {
    return this.value;
  }

  equals(other: SubjectType): boolean {
    return this.value === other.value;
  }
}
