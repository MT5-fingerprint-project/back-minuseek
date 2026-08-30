import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { CaseVerification } from '../entity/case-verification';

export interface CaseVerificationRepository {
  save(
    verification: CaseVerification,
    ...acts: AuditEventDraft[]
  ): Promise<void>;
  findById(id: string): Promise<CaseVerification | null>;
  hasPendingFor(caseId: string, verifierUserId: string): Promise<boolean>;
}

export const CASE_VERIFICATION_REPOSITORY = 'CaseVerificationRepository';
