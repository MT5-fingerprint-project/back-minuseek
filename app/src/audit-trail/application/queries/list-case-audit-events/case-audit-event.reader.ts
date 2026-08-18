import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { CaseAuditEventReadModel } from './case-audit-event-read-model';

export interface CaseAuditEventReader {
  findByCase(
    caseId: string,
    filters: { eventType?: AuditEventTypeEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ items: CaseAuditEventReadModel[]; total: number }>;
}

export const CASE_AUDIT_EVENT_READER = 'CaseAuditEventReader';
