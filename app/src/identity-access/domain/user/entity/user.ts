import { UserRole } from '../value-objects/user-role.vo';
import { UserStatus } from '../value-objects/user-status.vo';
import { PersonalData } from '../value-objects/personal-data.vo';
import { InvalidUserProfileError } from '../errors/invalid-user-profile.error';

interface RegisterUserProps {
  id: string;
  identityProviderId: string;
  role: UserRole;
  grade: string;
  serviceNumber: string;
  personalData: PersonalData;
}

export interface UserProfileCorrection {
  firstName: string;
  lastName: string;
  grade: string;
  serviceNumber: string;
}

export interface UserPrimitives {
  id: string;
  identityProviderId: string;
  role: string;
  grade: string;
  serviceNumber: string;
  status: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export function requireFilled(value: string, field: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new InvalidUserProfileError(field);
  }
  return trimmed;
}

export class User {
  private constructor(
    private readonly _id: string,
    private readonly _identityProviderId: string,
    private readonly _role: UserRole,
    private _grade: string,
    private _serviceNumber: string,
    private _personalData: PersonalData,
    private _status: UserStatus,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static register(props: RegisterUserProps): User {
    if (!props.id) {
      throw new Error('User id is required');
    }
    if (!props.identityProviderId) {
      throw new Error('User identityProviderId is required');
    }
    const now = new Date();
    return new User(
      props.id,
      props.identityProviderId,
      props.role,
      requireFilled(props.grade, 'grade'),
      requireFilled(props.serviceNumber, 'serviceNumber'),
      props.personalData,
      UserStatus.active(),
      now,
      now,
    );
  }

  static reconstitute(primitives: UserPrimitives): User {
    return new User(
      primitives.id,
      primitives.identityProviderId,
      UserRole.from(primitives.role),
      primitives.grade,
      primitives.serviceNumber,
      PersonalData.of({
        firstName: primitives.firstName,
        lastName: primitives.lastName,
      }),
      UserStatus.from(primitives.status),
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  /** Projection de l'état du compte chez le fournisseur d'identité, qui reste
   * seul à décider si le compte se connecte. */
  disable(): void {
    this._status = UserStatus.disabled();
    this._updatedAt = new Date();
  }

  reactivate(): void {
    this._status = UserStatus.active();
    this._updatedAt = new Date();
  }

  correctProfile(correction: UserProfileCorrection): void {
    const grade = requireFilled(correction.grade, 'grade');
    const serviceNumber = requireFilled(
      correction.serviceNumber,
      'serviceNumber',
    );
    const personalData = PersonalData.of({
      firstName: correction.firstName,
      lastName: correction.lastName,
    });

    this._grade = grade;
    this._serviceNumber = serviceNumber;
    this._personalData = personalData;
    this._updatedAt = new Date();
  }

  toPrimitives(): UserPrimitives {
    return {
      id: this._id,
      identityProviderId: this._identityProviderId,
      role: this._role.getValue(),
      grade: this._grade,
      serviceNumber: this._serviceNumber,
      status: this._status.getValue(),
      firstName: this._personalData.firstName,
      lastName: this._personalData.lastName,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }

  get id(): string {
    return this._id;
  }

  get identityProviderId(): string {
    return this._identityProviderId;
  }

  get role(): UserRole {
    return this._role;
  }

  get grade(): string {
    return this._grade;
  }

  get serviceNumber(): string {
    return this._serviceNumber;
  }

  get personalData(): PersonalData {
    return this._personalData;
  }

  get status(): UserStatus {
    return this._status;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
