import {
  InvalidWithdrawalDetailError,
  InvalidWithdrawalMotiveError,
  MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH,
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

  it("garde la phrase de l'opérateur sous OTHER, débarrassée de ses espaces", () => {
    const withdrawal = Withdrawal.of('OTHER', AT, '  cliché illisible  ');

    expect(withdrawal.getMotive()).toBe(WithdrawalMotiveEnum.OTHER);
    expect(withdrawal.getDetail()).toBe('cliché illisible');
  });

  it('refuse OTHER sans phrase', () => {
    expect(() => Withdrawal.of('OTHER', AT)).toThrow(
      InvalidWithdrawalDetailError,
    );
    expect(() => Withdrawal.of('OTHER', AT, '   ')).toThrow(
      InvalidWithdrawalDetailError,
    );
  });

  it('refuse une phrase plus longue que la colonne', () => {
    expect(() =>
      Withdrawal.of(
        'OTHER',
        AT,
        'a'.repeat(MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH + 1),
      ),
    ).toThrow(InvalidWithdrawalDetailError);
  });

  it('refuse une phrase avec un motif de la liste : elle ne serait jamais lue', () => {
    expect(() => Withdrawal.of('DUPLICATE', AT, 'une phrase')).toThrow(
      InvalidWithdrawalDetailError,
    );
  });

  it('ne porte aucune phrase sous un motif de la liste', () => {
    expect(Withdrawal.of('MISFILED', AT).getDetail()).toBeNull();
  });
});
