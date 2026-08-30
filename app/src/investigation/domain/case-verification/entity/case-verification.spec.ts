import { InvalidVerificationStatusError } from '../value-objects/verification-status.vo';
import { VerificationStatusEnum } from '../value-objects/verification-status.vo';
import { CaseVerification } from './case-verification';

const PRIMITIVES = {
  id: 'verification-1',
  caseId: 'case-1',
  verifierUserId: 'user-lucie',
  requestedByUserId: 'user-marie',
  status: VerificationStatusEnum.PENDING,
  requestedAt: new Date('2026-08-29T09:00:00.000Z'),
  completedAt: null,
};

describe('CaseVerification', () => {
  it('naît en cours, sans date de clôture', () => {
    const verification = CaseVerification.request({
      id: 'verification-1',
      caseId: 'case-1',
      verifierUserId: 'user-lucie',
      requestedByUserId: 'user-marie',
    });

    expect(verification.status).toBe(VerificationStatusEnum.PENDING);
    expect(verification.completedAt).toBeNull();
    expect(verification.verifierUserId).toBe('user-lucie');
    expect(verification.requestedByUserId).toBe('user-marie');
  });

  it("rend les primitives telles qu'elle a été relue", () => {
    expect(CaseVerification.reconstitute(PRIMITIVES).toPrimitives()).toEqual(
      PRIMITIVES,
    );
  });

  it('refuse de se relire sur un statut hors catalogue', () => {
    expect(() =>
      CaseVerification.reconstitute({ ...PRIMITIVES, status: 'TERMINEE' }),
    ).toThrow(InvalidVerificationStatusError);
  });

  it("ne laisse pas modifier la date de mission par l'objet rendu", () => {
    const verification = CaseVerification.reconstitute(PRIMITIVES);

    verification.requestedAt.setFullYear(1999);

    expect(verification.requestedAt.getFullYear()).toBe(2026);
  });
});
