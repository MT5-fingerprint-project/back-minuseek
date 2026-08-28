import {
  InvalidWithdrawalMotiveError,
  Withdrawal,
  WithdrawalMotiveEnum,
} from './withdrawal.vo';

const AT = new Date('2026-08-12T09:00:00.000Z');

describe('Withdrawal', () => {
  it('accepts a motive of the closed list', () => {
    const withdrawal = Withdrawal.of('DUPLICATE', AT);

    expect(withdrawal.getMotive()).toBe(WithdrawalMotiveEnum.DUPLICATE);
    expect(withdrawal.getAt()).toBe(AT);
  });

  it('refuses a motive outside the list', () => {
    expect(() => Withdrawal.of('BECAUSE_I_SAID_SO', AT)).toThrow(
      InvalidWithdrawalMotiveError,
    );
  });

  it('reads a piece that was never withdrawn as no withdrawal at all', () => {
    expect(Withdrawal.fromPersistence(null, null)).toBeNull();
  });

  it('reads back a withdrawn piece', () => {
    expect(Withdrawal.fromPersistence('MISFILED', AT)?.getMotive()).toBe(
      WithdrawalMotiveEnum.MISFILED,
    );
  });
});
