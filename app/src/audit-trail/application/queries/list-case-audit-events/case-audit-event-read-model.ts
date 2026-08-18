import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';

export interface CaseAuditEventActorReadModel {
  displayName: string;
  username: string;
}

export interface CaseAuditEventReadModel {
  seq: number;
  eventType: AuditEventTypeEnum;
  evidenceClass: EvidenceClassEnum;
  actor: CaseAuditEventActorReadModel;
  occurredAt: Date;
  payload: Record<string, unknown>;
}
