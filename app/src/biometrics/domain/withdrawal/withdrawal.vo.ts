export enum WithdrawalMotiveEnum {
  DUPLICATE = 'DUPLICATE',
  MISFILED = 'MISFILED',
  WRONG_ATTRIBUTION = 'WRONG_ATTRIBUTION',
}

export class InvalidWithdrawalMotiveError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un motif de retrait valide`);
  }
}

export class Withdrawal {
  private constructor(
    private readonly motive: WithdrawalMotiveEnum,
    private readonly at: Date,
  ) {}

  static of(motive: string, at: Date): Withdrawal {
    if (
      !Object.values(WithdrawalMotiveEnum).includes(
        motive as WithdrawalMotiveEnum,
      )
    ) {
      throw new InvalidWithdrawalMotiveError(motive);
    }
    return new Withdrawal(motive as WithdrawalMotiveEnum, at);
  }

  static fromPersistence(
    motive: string | null,
    at: Date | null,
  ): Withdrawal | null {
    return motive === null || at === null ? null : Withdrawal.of(motive, at);
  }

  getMotive(): WithdrawalMotiveEnum {
    return this.motive;
  }

  getAt(): Date {
    return this.at;
  }
}
