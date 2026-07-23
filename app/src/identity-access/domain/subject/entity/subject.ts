import { Sex } from '../value-objects/sex.vo';
import { SubjectType } from '../value-objects/subject-type.vo';

interface RegisterSubjectProps {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  birthPlace: string;
  firstParentName?: string | null;
  secondParentName?: string | null;
  phoneNumber?: string | null;
  sex: Sex;
  type: SubjectType;
  color?: string | null;
  caseId: string;
}

export interface SubjectPrimitives {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  birthPlace: string;
  firstParentName: string | null;
  secondParentName: string | null;
  phoneNumber: string | null;
  sex: string;
  type: string;
  color: string | null;
  caseId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Subject {
  private constructor(
    private readonly _id: string,
    private readonly _firstName: string,
    private readonly _lastName: string,
    private readonly _birthDate: Date,
    private readonly _birthPlace: string,
    private readonly _firstParentName: string | null,
    private readonly _secondParentName: string | null,
    private readonly _phoneNumber: string | null,
    private readonly _sex: Sex,
    private readonly _type: SubjectType,
    private readonly _color: string | null,
    private readonly _caseId: string,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date,
  ) {}

  static register(props: RegisterSubjectProps): Subject {
    if (!props.id) {
      throw new Error('Subject id is required');
    }
    if (!props.firstName?.trim()) {
      throw new Error('Subject firstName is required');
    }
    if (!props.lastName?.trim()) {
      throw new Error('Subject lastName is required');
    }
    if (!props.birthPlace?.trim()) {
      throw new Error('Subject birthPlace is required');
    }
    if (
      !(props.birthDate instanceof Date) ||
      Number.isNaN(props.birthDate.getTime())
    ) {
      throw new Error('Subject birthDate is invalid');
    }
    if (!props.caseId) {
      throw new Error('Subject caseId is required');
    }
    const now = new Date();
    return new Subject(
      props.id,
      props.firstName.trim(),
      props.lastName.trim(),
      props.birthDate,
      props.birthPlace.trim(),
      Subject.normalizeOptional(props.firstParentName),
      Subject.normalizeOptional(props.secondParentName),
      Subject.normalizeOptional(props.phoneNumber),
      props.sex,
      props.type,
      Subject.normalizeOptional(props.color),
      props.caseId,
      now,
      now,
    );
  }

  static reconstitute(primitives: SubjectPrimitives): Subject {
    return new Subject(
      primitives.id,
      primitives.firstName,
      primitives.lastName,
      primitives.birthDate,
      primitives.birthPlace,
      primitives.firstParentName,
      primitives.secondParentName,
      primitives.phoneNumber,
      Sex.from(primitives.sex),
      SubjectType.from(primitives.type),
      primitives.color,
      primitives.caseId,
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  private static normalizeOptional(value?: string | null): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  toPrimitives(): SubjectPrimitives {
    return {
      id: this._id,
      firstName: this._firstName,
      lastName: this._lastName,
      birthDate: this._birthDate,
      birthPlace: this._birthPlace,
      firstParentName: this._firstParentName,
      secondParentName: this._secondParentName,
      phoneNumber: this._phoneNumber,
      sex: this._sex.getValue(),
      type: this._type.getValue(),
      color: this._color,
      caseId: this._caseId,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  get id(): string {
    return this._id;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get birthDate(): Date {
    return this._birthDate;
  }

  get birthPlace(): string {
    return this._birthPlace;
  }

  get firstParentName(): string | null {
    return this._firstParentName;
  }

  get secondParentName(): string | null {
    return this._secondParentName;
  }

  get phoneNumber(): string | null {
    return this._phoneNumber;
  }

  get sex(): Sex {
    return this._sex;
  }

  get type(): SubjectType {
    return this._type;
  }

  get color(): string | null {
    return this._color;
  }

  get caseId(): string {
    return this._caseId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
