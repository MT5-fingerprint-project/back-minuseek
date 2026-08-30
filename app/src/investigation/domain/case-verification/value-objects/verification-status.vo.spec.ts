import {
  InvalidVerificationStatusError,
  VerificationStatus,
  VerificationStatusEnum,
} from './verification-status.vo';

describe('VerificationStatus', () => {
  it("naît en attente quand la mission vient d'être confiée", () => {
    expect(VerificationStatus.pending().getValue()).toBe(
      VerificationStatusEnum.PENDING,
    );
  });

  it.each(Object.values(VerificationStatusEnum))(
    'relit %s tel quel depuis la base',
    (raw) => {
      expect(VerificationStatus.from(raw).getValue()).toBe(raw);
    },
  );

  it.each(['pending', ' PENDING ', '', 'CLOSED', '__proto__', 'toString'])(
    'refuse "%s", qui n\'est pas un statut de mission',
    (raw) => {
      expect(() => VerificationStatus.from(raw)).toThrow(
        InvalidVerificationStatusError,
      );
    },
  );

  it('cite la valeur reçue dans le message de refus', () => {
    expect(() => VerificationStatus.from('TERMINEE')).toThrow(
      '"TERMINEE" n\'est pas un statut de vérification valide',
    );
  });

  it('distingue la mission en cours de la mission close', () => {
    expect(VerificationStatus.pending().isPending()).toBe(true);
    expect(
      VerificationStatus.from(VerificationStatusEnum.CONCORDANT).isPending(),
    ).toBe(false);
  });
});
