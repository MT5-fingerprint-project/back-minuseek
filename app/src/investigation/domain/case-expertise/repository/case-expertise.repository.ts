import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { CaseExpertise } from '../entity/case-expertise';

export interface CaseExpertiseRepository {
  save(expertise: CaseExpertise, ...acts: AuditEventDraft[]): Promise<void>;
  existsForCase(caseId: string): Promise<boolean>;
}

export const CASE_EXPERTISE_REPOSITORY = 'CaseExpertiseRepository';
