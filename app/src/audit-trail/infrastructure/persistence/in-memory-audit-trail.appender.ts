import { AuditEventType } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClass } from '../../../shared/domain/audit/evidence-class.vo';
import {
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  AuditEvent,
  AuditEventPrimitives,
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../domain/audit-event/entity/audit-event';
import { computeEventHash } from '../../domain/services/audit-event-hash';

export class InMemoryAuditTrailAppender implements AuditTrailPort {
  readonly events: AuditEventPrimitives[] = [];

  append(draft: AuditEventDraft): Promise<AuditLink> {
    const head = this.events.at(-1);
    const seq = head ? head.seq + 1n : GENESIS_SEQ;
    const prevHash = head ? head.hash : GENESIS_PREV_HASH;
    const occurredAt = new Date();
    const hash = computeEventHash({
      seq,
      eventType: draft.eventType,
      evidenceClass: draft.evidenceClass,
      actor: draft.actor,
      caseId: draft.caseId ?? null,
      traceId: draft.traceId ?? null,
      payload: draft.payload,
      occurredAt,
      prevHash,
    });
    const event = AuditEvent.chain({
      id: `audit-event-${seq}`,
      seq,
      eventType: AuditEventType.from(draft.eventType),
      evidenceClass: EvidenceClass.from(draft.evidenceClass),
      actor: draft.actor,
      caseId: draft.caseId,
      traceId: draft.traceId,
      payload: draft.payload,
      occurredAt,
      prevHash,
      hash,
    });
    this.events.push(event.toPrimitives());
    return Promise.resolve({ seq, occurredAt });
  }
}
