import { VerificationDecision } from './entity/verification-decision';
import { DecisionOutcomeEnum } from './value-objects/decision-outcome.vo';
import { VerificationExploitabilityEnum } from './value-objects/verification-exploitability.vo';

export interface OperatorExploitation {
  status: string;
  identifiedReferencePrintIds: string[];
}

export interface OperatorTraceExploitation extends OperatorExploitation {
  traceId: string;
}

export interface VerifierConclusion {
  exploitability: VerificationExploitabilityEnum;
  identifiedReferencePrintId: string | null;
}

export function confrontTrace(
  operator: OperatorExploitation,
  verifier: VerifierConclusion,
): DecisionOutcomeEnum {
  const sameExploitability =
    operator.status === (verifier.exploitability as string);
  const verifierPrints =
    verifier.identifiedReferencePrintId === null
      ? []
      : [verifier.identifiedReferencePrintId];
  const sameIdentification =
    operator.identifiedReferencePrintIds.length === verifierPrints.length &&
    verifierPrints.every((printId) =>
      operator.identifiedReferencePrintIds.includes(printId),
    );

  return sameExploitability && sameIdentification
    ? DecisionOutcomeEnum.CONCORDANT
    : DecisionOutcomeEnum.DISCORDANT;
}

export function confrontDecisions(
  traces: OperatorTraceExploitation[],
  decisions: VerificationDecision[],
): string[] {
  const discordantTraceIds: string[] = [];
  for (const trace of traces) {
    const decision = decisions.find(
      (candidate) => candidate.traceId === trace.traceId,
    );
    if (!decision) continue;
    const outcome = confrontTrace(trace, {
      exploitability: decision.exploitability,
      identifiedReferencePrintId: decision.identifiedReferencePrintId,
    });
    decision.confront(outcome);
    if (outcome === DecisionOutcomeEnum.DISCORDANT) {
      discordantTraceIds.push(trace.traceId);
    }
  }
  return discordantTraceIds;
}
