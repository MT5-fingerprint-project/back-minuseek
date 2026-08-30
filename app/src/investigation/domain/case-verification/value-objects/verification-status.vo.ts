export enum VerificationStatusEnum {
  PENDING = 'PENDING',
  CONCORDANT = 'CONCORDANT',
  DISCORDANT = 'DISCORDANT',
}

export class InvalidVerificationStatusError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un statut de vérification valide`);
  }
}

export class VerificationStatus {
  private constructor(private readonly value: VerificationStatusEnum) {}

  static from(raw: string): VerificationStatus {
    if (
      !Object.values(VerificationStatusEnum).includes(
        raw as VerificationStatusEnum,
      )
    ) {
      throw new InvalidVerificationStatusError(raw);
    }
    return new VerificationStatus(raw as VerificationStatusEnum);
  }

  static pending(): VerificationStatus {
    return new VerificationStatus(VerificationStatusEnum.PENDING);
  }

  isPending(): boolean {
    return this.value === VerificationStatusEnum.PENDING;
  }

  getValue(): VerificationStatusEnum {
    return this.value;
  }
}
