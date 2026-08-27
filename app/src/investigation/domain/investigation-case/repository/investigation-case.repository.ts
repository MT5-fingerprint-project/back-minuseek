import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { InvestigationCase } from '../entity/investigation-case';

export interface InvestigationCaseRepository {
  save(c: InvestigationCase, ...acts: AuditEventDraft[]): Promise<void>;
  findById(id: string): Promise<InvestigationCase | null>;
  existsByCaseNumber(caseNumber: string): Promise<boolean>;
}

export const INVESTIGATION_CASE_REPOSITORY = 'InvestigationCaseRepository';
