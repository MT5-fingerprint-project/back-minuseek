import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { VerificationDecision } from '../entity/verification-decision';

export interface VerificationDecisionRepository {
  findByVerificationId(verificationId: string): Promise<VerificationDecision[]>;
  save(
    decision: VerificationDecision,
    ...acts: AuditEventDraft[]
  ): Promise<void>;
  saveAll(decisions: VerificationDecision[]): Promise<void>;
}

export const VERIFICATION_DECISION_REPOSITORY =
  'VerificationDecisionRepository';
