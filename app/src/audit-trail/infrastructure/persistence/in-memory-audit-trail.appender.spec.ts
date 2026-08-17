import { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import {
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../domain/audit-event/entity/audit-event';
import { computeEventHash } from '../../domain/services/audit-event-hash';
import { InMemoryAuditTrailAppender } from './in-memory-audit-trail.appender';

const EXPERT = AuditActor.user({
  sub: 'kc-sub-42',
  username: 'jdupont',
  displayName: 'Jean Dupont',
});

describe('InMemoryAuditTrailAppender', () => {
  it('chaîne les événements comme le vrai appender (genesis puis seq + 1)', async () => {
    const appender = new InMemoryAuditTrailAppender();

    await appender.append({
      eventType: AuditEventTypeEnum.CASE_OPENED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: EXPERT,
      caseId: 'case-1',
      payload: { caseNumber: 'AFF-001' },
    });
    await appender.append({
      eventType: AuditEventTypeEnum.TRACE_UPLOADED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: EXPERT,
      caseId: 'case-1',
      traceId: 'trace-1',
      payload: { sha256: 'f'.repeat(64) },
    });

    const [genesis, second] = appender.events;
    expect(genesis.seq).toBe(GENESIS_SEQ);
    expect(genesis.prevHash).toBe(GENESIS_PREV_HASH);
    expect(second.seq).toBe(2n);
    expect(second.prevHash).toBe(genesis.hash);
  });

  it('produit des hashes recalculables avec le vrai computeEventHash', async () => {
    const appender = new InMemoryAuditTrailAppender();

    await appender.append({
      eventType: AuditEventTypeEnum.CASE_OPENED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: EXPERT,
      payload: { caseNumber: 'AFF-001' },
    });

    const [event] = appender.events;
    expect(event.hash).toBe(
      computeEventHash({
        seq: event.seq,
        eventType: event.eventType,
        evidenceClass: event.evidenceClass,
        actor: AuditActor.reconstitute(event.actor),
        caseId: event.caseId,
        traceId: event.traceId,
        payload: event.payload,
        occurredAt: event.occurredAt,
        prevHash: event.prevHash,
      }),
    );
  });
});
