export enum WithdrawalMotiveEnum {
  DUPLICATE = 'DUPLICATE',
  MISFILED = 'MISFILED',
  WRONG_ATTRIBUTION = 'WRONG_ATTRIBUTION',
  OTHER = 'OTHER',
}

export const MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH = 300;

export class InvalidWithdrawalMotiveError extends Error {
  constructor(value: string) {
    super(`"${value}" n'est pas un motif de retrait valide`);
  }
}

export class InvalidWithdrawalDetailError extends Error {
  constructor(reason: string) {
    super(`La précision du motif de retrait est invalide : ${reason}`);
  }
}

export class Withdrawal {
  private constructor(
    private readonly motive: WithdrawalMotiveEnum,
    private readonly at: Date,
    private readonly detail: string | null,
  ) {}

  static of(motive: string, at: Date, detail?: string | null): Withdrawal {
    if (
      !Object.values(WithdrawalMotiveEnum).includes(
        motive as WithdrawalMotiveEnum,
      )
    ) {
      throw new InvalidWithdrawalMotiveError(motive);
    }
    return new Withdrawal(
      motive as WithdrawalMotiveEnum,
      at,
      withdrawalDetailOf(motive as WithdrawalMotiveEnum, detail ?? null),
    );
  }

  static fromPersistence(
    motive: string | null,
    at: Date | null,
    detail: string | null = null,
  ): Withdrawal | null {
    return motive === null || at === null
      ? null
      : Withdrawal.of(motive, at, detail);
  }

  getMotive(): WithdrawalMotiveEnum {
    return this.motive;
  }

  getAt(): Date {
    return this.at;
  }

  getDetail(): string | null {
    return this.detail;
  }
}

/** Rend la précision débarrassée de ses espaces, ou refuse le couple motif-précision. */
export function withdrawalDetailOf(
  motive: WithdrawalMotiveEnum,
  detail: string | null,
): string | null {
  const written = detail?.trim() ?? '';

  if (motive !== WithdrawalMotiveEnum.OTHER) {
    if (written.length > 0) {
      throw new InvalidWithdrawalDetailError(
        `elle n'est acceptée qu'avec le motif ${WithdrawalMotiveEnum.OTHER}`,
      );
    }
    return null;
  }

  if (written.length === 0) {
    throw new InvalidWithdrawalDetailError(
      `elle est obligatoire avec le motif ${WithdrawalMotiveEnum.OTHER}`,
    );
  }
  if (written.length > MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH) {
    throw new InvalidWithdrawalDetailError(
      `elle ne peut pas dépasser ${MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH} caractères`,
    );
  }
  return written;
}
