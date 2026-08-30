import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { confrontDecisions } from '../../../domain/case-verification/confrontation';
import { CaseVerification } from '../../../domain/case-verification/entity/case-verification';
import { VerificationDecision } from '../../../domain/case-verification/entity/verification-decision';
import { TransactionRunner } from '../../../../shared/domain/ports/transaction-runner';
import { CaseVerificationRepository } from '../../../domain/case-verification/repository/case-verification.repository';
import { VerificationDecisionRepository } from '../../../domain/case-verification/repository/verification-decision.repository';
import { DecisionOutcomeEnum } from '../../../domain/case-verification/value-objects/decision-outcome.vo';
import { ExploitedTrace } from '../../ports/case-exploitation.reader';

export async function confrontAndClose(
  verification: CaseVerification,
  traces: ExploitedTrace[],
  decisions: VerificationDecision[],
  actor: AuditActor,
  repositories: {
    verifications: CaseVerificationRepository;
    decisions: VerificationDecisionRepository;
    transactions: TransactionRunner;
  },
): Promise<void> {
  const discordantTraceIds = confrontDecisions(traces, decisions);
  verification.complete(
    discordantTraceIds.length === 0
      ? DecisionOutcomeEnum.CONCORDANT
      : DecisionOutcomeEnum.DISCORDANT,
  );

  await repositories.transactions.run(async () => {
    await repositories.decisions.saveAll(decisions);
    await repositories.verifications.save(verification, {
      eventType: AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor,
      caseId: verification.caseId,
      payload: {
        verificationId: verification.id,
        verdict: verification.status,
        discordantTraceCount: discordantTraceIds.length,
        discordantTraceIds,
      },
    });
  });
}
