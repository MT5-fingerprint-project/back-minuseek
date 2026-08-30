import { DecisionOutcomeEnum } from '../value-objects/decision-outcome.vo';
import {
  InvalidVerificationExploitabilityError,
  VerificationExploitabilityEnum,
} from '../value-objects/verification-exploitability.vo';
import { VerificationDecision } from './verification-decision';

const PRIMITIVES = {
  id: 'decision-1',
  verificationId: 'verification-1',
  traceId: 'trace-1',
  exploitability: VerificationExploitabilityEnum.EXPLOITABLE,
  identifiedReferencePrintId: 'ref-1',
  outcome: DecisionOutcomeEnum.CONCORDANT,
  statedAt: new Date('2026-08-20T09:00:00.000Z'),
};

const stated = () =>
  VerificationDecision.state({
    id: 'decision-1',
    verificationId: 'verification-1',
    traceId: 'trace-1',
    exploitability: VerificationExploitabilityEnum.EXPLOITABLE,
    identifiedReferencePrintId: 'ref-1',
  });

describe('VerificationDecision', () => {
  it('naît sans verdict : la confrontation vient à la validation', () => {
    const decision = stated();

    expect(decision.outcome).toBeNull();
    expect(decision.exploitability).toBe(
      VerificationExploitabilityEnum.EXPLOITABLE,
    );
    expect(decision.identifiedReferencePrintId).toBe('ref-1');
  });

  it("rend les primitives telles qu'elle a été relue", () => {
    expect(
      VerificationDecision.reconstitute(PRIMITIVES).toPrimitives(),
    ).toEqual(PRIMITIVES);
  });

  it('refuse de se relire sur une exploitabilité hors catalogue', () => {
    expect(() =>
      VerificationDecision.reconstitute({
        ...PRIMITIVES,
        exploitability: 'RECEIVED',
      }),
    ).toThrow(InvalidVerificationExploitabilityError);
  });

  it('oublie son verdict quand le vérificateur revient sur sa conclusion', () => {
    const decision = VerificationDecision.reconstitute(PRIMITIVES);

    decision.restate(VerificationExploitabilityEnum.NOT_EXPLOITABLE, null);

    expect(decision.exploitability).toBe(
      VerificationExploitabilityEnum.NOT_EXPLOITABLE,
    );
    expect(decision.identifiedReferencePrintId).toBeNull();
    expect(decision.outcome).toBeNull();
  });

  it('porte le verdict de la confrontation', () => {
    const decision = stated();

    decision.confront(DecisionOutcomeEnum.DISCORDANT);

    expect(decision.outcome).toBe(DecisionOutcomeEnum.DISCORDANT);
  });

  it('redate la conclusion à chaque révision', () => {
    const decision = VerificationDecision.reconstitute(PRIMITIVES);

    decision.restate(VerificationExploitabilityEnum.EXPLOITABLE, 'ref-2');

    expect(decision.statedAt.getTime()).toBeGreaterThan(
      PRIMITIVES.statedAt.getTime(),
    );
  });
});
