export enum UserStatusEnum {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export class InvalidUserStatusError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un état de compte valide`);
  }
}

export class UserStatus {
  private constructor(private readonly value: UserStatusEnum) {}

  static from(raw: string): UserStatus {
    if (!Object.values(UserStatusEnum).includes(raw as UserStatusEnum)) {
      throw new InvalidUserStatusError(raw);
    }
    return new UserStatus(raw as UserStatusEnum);
  }

  static active(): UserStatus {
    return new UserStatus(UserStatusEnum.ACTIVE);
  }

  static disabled(): UserStatus {
    return new UserStatus(UserStatusEnum.DISABLED);
  }

  getValue(): UserStatusEnum {
    return this.value;
  }

  equals(other: UserStatus): boolean {
    return this.value === other.value;
  }
}
