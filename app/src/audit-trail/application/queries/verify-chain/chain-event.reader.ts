import { AuditActorPrimitives } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';

export interface ChainEventRow {
  seq: bigint;
  eventType: AuditEventTypeEnum;
  evidenceClass: EvidenceClassEnum;
  actor: AuditActorPrimitives;
  caseId: string | null;
  traceId: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
  prevHash: string;
  hash: string;
}

export interface ChainHead {
  seq: bigint;
  hash: string;
  eventType: AuditEventTypeEnum;
}

export interface ChainEventReader {
  findBatchAfter(seq: bigint, take: number): Promise<ChainEventRow[]>;
  findHead(): Promise<ChainHead | null>;
  findBySeq(seq: bigint): Promise<ChainEventRow | null>;
}

export const CHAIN_EVENT_READER = 'ChainEventReader';
