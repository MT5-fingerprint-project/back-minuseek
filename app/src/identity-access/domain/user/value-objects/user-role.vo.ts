export enum UserRoleEnum {
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  EXPERT = 'EXPERT',
}

export class InvalidUserRoleError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un rôle valide`);
  }
}

export class UserRole {
  private constructor(private readonly value: UserRoleEnum) {}

  static from(raw: string): UserRole {
    if (!Object.values(UserRoleEnum).includes(raw as UserRoleEnum)) {
      throw new InvalidUserRoleError(raw);
    }
    return new UserRole(raw as UserRoleEnum);
  }

  static admin(): UserRole {
    return new UserRole(UserRoleEnum.ADMIN);
  }

  static operator(): UserRole {
    return new UserRole(UserRoleEnum.OPERATOR);
  }

  static expert(): UserRole {
    return new UserRole(UserRoleEnum.EXPERT);
  }

  getValue(): UserRoleEnum {
    return this.value;
  }

  equals(other: UserRole): boolean {
    return this.value === other.value;
  }
}
