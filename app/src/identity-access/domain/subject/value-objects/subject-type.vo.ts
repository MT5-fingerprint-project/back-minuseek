export enum SubjectTypeEnum {
  CLOSE_ASSOCIATE = 'CLOSE_ASSOCIATE',
  PERSON_OF_INTEREST = 'PERSON_OF_INTEREST',
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

  static closeAssociate(): SubjectType {
    return new SubjectType(SubjectTypeEnum.CLOSE_ASSOCIATE);
  }

  static personOfInterest(): SubjectType {
    return new SubjectType(SubjectTypeEnum.PERSON_OF_INTEREST);
  }

  getValue(): SubjectTypeEnum {
    return this.value;
  }

  equals(other: SubjectType): boolean {
    return this.value === other.value;
  }
}
