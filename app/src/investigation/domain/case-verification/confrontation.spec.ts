import { confrontDecisions, confrontTrace } from './confrontation';
import { VerificationDecision } from './entity/verification-decision';
import { DecisionOutcomeEnum } from './value-objects/decision-outcome.vo';
import { VerificationExploitabilityEnum } from './value-objects/verification-exploitability.vo';

const EXPLOITABLE = VerificationExploitabilityEnum.EXPLOITABLE;
const NOT_EXPLOITABLE = VerificationExploitabilityEnum.NOT_EXPLOITABLE;

describe('confrontTrace', () => {
  it('concorde quand les deux déclarent exploitable et désignent la même empreinte', () => {
    expect(
      confrontTrace(
        { status: 'EXPLOITABLE', identifiedReferencePrintIds: ['ref-1'] },
        { exploitability: EXPLOITABLE, identifiedReferencePrintId: 'ref-1' },
      ),
    ).toBe(DecisionOutcomeEnum.CONCORDANT);
  });

  it('concorde quand les deux déclarent inexploitable sans identification', () => {
    expect(
      confrontTrace(
        { status: 'NOT_EXPLOITABLE', identifiedReferencePrintIds: [] },
        {
          exploitability: NOT_EXPLOITABLE,
          identifiedReferencePrintId: null,
        },
      ),
    ).toBe(DecisionOutcomeEnum.CONCORDANT);
  });

  it('concorde quand les deux ont comparé sans rien identifier', () => {
    expect(
      confrontTrace(
        { status: 'EXPLOITABLE', identifiedReferencePrintIds: [] },
        { exploitability: EXPLOITABLE, identifiedReferencePrintId: null },
      ),
    ).toBe(DecisionOutcomeEnum.CONCORDANT);
  });

  it("diverge sur la déclaration d'exploitabilité", () => {
    expect(
      confrontTrace(
        { status: 'EXPLOITABLE', identifiedReferencePrintIds: [] },
        { exploitability: NOT_EXPLOITABLE, identifiedReferencePrintId: null },
      ),
    ).toBe(DecisionOutcomeEnum.DISCORDANT);
  });

  it('diverge quand chacun désigne une empreinte différente', () => {
    expect(
      confrontTrace(
        { status: 'EXPLOITABLE', identifiedReferencePrintIds: ['ref-1'] },
        { exploitability: EXPLOITABLE, identifiedReferencePrintId: 'ref-2' },
      ),
    ).toBe(DecisionOutcomeEnum.DISCORDANT);
  });

  it("diverge quand le titulaire identifie et que le vérificateur n'identifie pas", () => {
    expect(
      confrontTrace(
        { status: 'EXPLOITABLE', identifiedReferencePrintIds: ['ref-1'] },
        { exploitability: EXPLOITABLE, identifiedReferencePrintId: null },
      ),
    ).toBe(DecisionOutcomeEnum.DISCORDANT);
  });

  it('diverge quand le titulaire en désigne deux et le vérificateur une seule', () => {
    expect(
      confrontTrace(
        {
          status: 'EXPLOITABLE',
          identifiedReferencePrintIds: ['ref-1', 'ref-2'],
        },
        { exploitability: EXPLOITABLE, identifiedReferencePrintId: 'ref-1' },
      ),
    ).toBe(DecisionOutcomeEnum.DISCORDANT);
  });

  it("diverge quand le titulaire n'a rien déclaré sur la trace", () => {
    expect(
      confrontTrace(
        { status: 'RECEIVED', identifiedReferencePrintIds: [] },
        { exploitability: EXPLOITABLE, identifiedReferencePrintId: null },
      ),
    ).toBe(DecisionOutcomeEnum.DISCORDANT);
  });
});

describe('confrontDecisions', () => {
  const decision = (traceId: string, printId: string | null) =>
    VerificationDecision.state({
      id: `decision-${traceId}`,
      verificationId: 'verification-1',
      traceId,
      exploitability: EXPLOITABLE,
      identifiedReferencePrintId: printId,
    });

  it('marque chaque conclusion et rend les traces qui divergent', () => {
    const decisions = [decision('trace-1', 'ref-1'), decision('trace-2', null)];

    const discordant = confrontDecisions(
      [
        {
          traceId: 'trace-1',
          status: 'EXPLOITABLE',
          identifiedReferencePrintIds: ['ref-1'],
        },
        {
          traceId: 'trace-2',
          status: 'EXPLOITABLE',
          identifiedReferencePrintIds: ['ref-9'],
        },
      ],
      decisions,
    );

    expect(discordant).toEqual(['trace-2']);
    expect(decisions[0].outcome).toBe(DecisionOutcomeEnum.CONCORDANT);
    expect(decisions[1].outcome).toBe(DecisionOutcomeEnum.DISCORDANT);
  });

  it("laisse sans verdict une trace sur laquelle rien n'a été conclu", () => {
    const decisions = [decision('trace-1', 'ref-1')];

    const discordant = confrontDecisions(
      [
        {
          traceId: 'trace-1',
          status: 'EXPLOITABLE',
          identifiedReferencePrintIds: ['ref-1'],
        },
        {
          traceId: 'trace-2',
          status: 'EXPLOITABLE',
          identifiedReferencePrintIds: [],
        },
      ],
      decisions,
    );

    expect(discordant).toEqual([]);
    expect(decisions).toHaveLength(1);
  });

  it("ignore une conclusion posée sur une trace qui n'est plus au dossier", () => {
    const retiree = decision('trace-retiree', null);

    const discordant = confrontDecisions([], [retiree]);

    expect(discordant).toEqual([]);
    expect(retiree.outcome).toBeNull();
  });
});
