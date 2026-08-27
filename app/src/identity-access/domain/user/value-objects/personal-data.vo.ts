import { InvalidUserProfileError } from '../errors/invalid-user-profile.error';

export interface PersonalDataPrimitives {
  firstName: string;
  lastName: string;
}

export class PersonalData {
  private constructor(
    private readonly _firstName: string,
    private readonly _lastName: string,
  ) {}

  static of(props: PersonalDataPrimitives): PersonalData {
    const firstName = props.firstName?.trim();
    const lastName = props.lastName?.trim();
    if (!firstName) {
      throw new InvalidUserProfileError('firstName');
    }
    if (!lastName) {
      throw new InvalidUserProfileError('lastName');
    }
    return new PersonalData(firstName, lastName);
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  toPrimitives(): PersonalDataPrimitives {
    return { firstName: this._firstName, lastName: this._lastName };
  }

  equals(other: PersonalData): boolean {
    return (
      this._firstName === other._firstName && this._lastName === other._lastName
    );
  }
}
