import { UserRole } from '../value-objects/user-role.vo';
import { PersonalData } from '../value-objects/personal-data.vo';

interface RegisterUserProps {
  id: string;
  identityProviderId: string;
  role: UserRole;
  grade: string;
  serviceNumber: string;
  personalData: PersonalData;
}

export interface UserPrimitives {
  id: string;
  identityProviderId: string;
  role: string;
  grade: string;
  serviceNumber: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(
    private readonly _id: string,
    private readonly _identityProviderId: string,
    private readonly _role: UserRole,
    private readonly _grade: string,
    private readonly _serviceNumber: string,
    private readonly _personalData: PersonalData,
    private readonly _createdAt: Date,
    private readonly _updatedAt: Date,
  ) {}

  static register(props: RegisterUserProps): User {
    if (!props.id) {
      throw new Error('User id is required');
    }
    if (!props.identityProviderId) {
      throw new Error('User identityProviderId is required');
    }
    if (!props.grade?.trim()) {
      throw new Error('User grade is required');
    }
    if (!props.serviceNumber?.trim()) {
      throw new Error('User serviceNumber is required');
    }
    const now = new Date();
    return new User(
      props.id,
      props.identityProviderId,
      props.role,
      props.grade.trim(),
      props.serviceNumber.trim(),
      props.personalData,
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
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  toPrimitives(): UserPrimitives {
    return {
      id: this._id,
      identityProviderId: this._identityProviderId,
      role: this._role.getValue(),
      grade: this._grade,
      serviceNumber: this._serviceNumber,
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

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
