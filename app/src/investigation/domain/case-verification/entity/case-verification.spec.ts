import { DecisionOutcomeEnum } from '../value-objects/decision-outcome.vo';
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

  it('se clôt sur le verdict de la confrontation, à la date du jour', () => {
    const verification = CaseVerification.reconstitute(PRIMITIVES);

    verification.complete(DecisionOutcomeEnum.DISCORDANT);

    expect(verification.status).toBe(VerificationStatusEnum.DISCORDANT);
    expect(verification.completedAt).not.toBeNull();
  });

  it('rejoue la confrontation sur une mission déjà close', () => {
    const verification = CaseVerification.reconstitute({
      ...PRIMITIVES,
      status: VerificationStatusEnum.DISCORDANT,
      completedAt: new Date('2026-08-20T10:00:00.000Z'),
    });

    verification.complete(DecisionOutcomeEnum.CONCORDANT);

    expect(verification.status).toBe(VerificationStatusEnum.CONCORDANT);
    expect(verification.completedAt?.getTime()).toBeGreaterThan(
      new Date('2026-08-20T10:00:00.000Z').getTime(),
    );
  });
});
