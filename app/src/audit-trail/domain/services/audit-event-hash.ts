import { createHash } from 'node:crypto';
import { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import { CanonicalizationError, canonicalJson } from './canonical-json';

// we compute the hash of an audit event from its canonicalized JSON representation, which includes all relevant fields for integrity and chaining, but excludes technical identifiers like `id` that do not contribute to the audit trail's verifiability.
export interface AuditEventHashInput {
  seq: bigint;
  eventType: AuditEventTypeEnum;
  evidenceClass: EvidenceClassEnum;
  actor: AuditActor;
  caseId: string | null;
  traceId: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  prevHash: string;
}

/** Pré-image du hash d'un maillon : c'est elle qu'une ancre TSA horodate. */
export function canonicalEventJson(input: AuditEventHashInput): string {
  if (Number.isNaN(input.occurredAt.getTime())) {
    throw new CanonicalizationError('"occurredAt" n\'est pas une date valide');
  }
  return canonicalJson({
    seq: input.seq,
    eventType: input.eventType,
    evidenceClass: input.evidenceClass,
    actor: input.actor.toPrimitives(),
    caseId: input.caseId,
    traceId: input.traceId,
    payload: input.payload,
    occurredAt: input.occurredAt.toISOString(),
    prevHash: input.prevHash,
  });
}

export function computeEventHash(input: AuditEventHashInput): string {
  return createHash('sha256')
    .update(canonicalEventJson(input), 'utf8')
    .digest('hex');
}
