import { AuditActor } from '../audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../audit/evidence-class.vo';

export const AUDIT_TRAIL = 'AuditTrail';

export interface AuditEventDraft {
  eventType: AuditEventTypeEnum;
  evidenceClass: EvidenceClassEnum;
  actor: AuditActor;
  caseId?: string | null;
  traceId?: string | null;
  payload: Record<string, unknown>;
}

export interface AuditTrailPort {
  append(draft: AuditEventDraft): Promise<void>;
}
