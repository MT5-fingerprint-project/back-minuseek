import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import {
  AuditEventType,
  AuditEventTypeEnum,
} from '../../../../shared/domain/audit/audit-event-type.vo';
import {
  EvidenceClass,
  EvidenceClassEnum,
} from '../../../../shared/domain/audit/evidence-class.vo';
import { AuditEvent, GENESIS_PREV_HASH, GENESIS_SEQ } from './audit-event';

const A_HASH = 'a'.repeat(64);
const B_HASH = 'b'.repeat(64);

function chainEvent(
  overrides: Partial<Parameters<typeof AuditEvent.chain>[0]> = {},
) {
  return AuditEvent.chain({
    id: '0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0',
    seq: 2n,
    eventType: AuditEventType.from(AuditEventTypeEnum.TRACE_UPLOADED),
    evidenceClass: EvidenceClass.observed(),
    actor: AuditActor.user({
      sub: 'a1b2c3',
      username: 'mdupont',
      displayName: 'Marie Dupont',
    }),
    caseId: 'c0ffee00-0000-4000-8000-000000000001',
    traceId: 'dec0de00-0000-4000-8000-000000000002',
    payload: { fileSha256: A_HASH, sizeBytes: 12345 },
    occurredAt: new Date('2026-08-02T10:00:00.000Z'),
    prevHash: A_HASH,
    hash: B_HASH,
    ...overrides,
  });
}

describe('AuditEvent', () => {
  it('chains an event with its position and hashes', () => {
    const event = chainEvent();

    expect(event.seq).toBe(2n);
    expect(event.prevHash).toBe(A_HASH);
    expect(event.hash).toBe(B_HASH);
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_UPLOADED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
  });

  it('recognises the genesis block', () => {
    const genesis = chainEvent({
      seq: GENESIS_SEQ,
      prevHash: GENESIS_PREV_HASH,
      eventType: AuditEventType.from(AuditEventTypeEnum.TENANT_PROVISIONED),
      actor: AuditActor.system('provisioner'),
    });

    expect(genesis.isGenesis()).toBe(true);
    expect(chainEvent().isGenesis()).toBe(false);
  });

  it('accepts an event that belongs to no case', () => {
    const event = chainEvent({ caseId: undefined, traceId: null });

    expect(event.caseId).toBeNull();
    expect(event.traceId).toBeNull();
  });

  it.each(['prevHash', 'hash'])('rejects a malformed %s', (field) => {
    expect(() => chainEvent({ [field]: 'not-a-hash' })).toThrow();
    expect(() => chainEvent({ [field]: A_HASH.toUpperCase() })).toThrow();
  });

  it('rejects a sequence number below genesis', () => {
    expect(() => chainEvent({ seq: 0n })).toThrow();
  });

  it('rejects an invalid date', () => {
    expect(() => chainEvent({ occurredAt: new Date('nope') })).toThrow();
  });

  it('rejects a payload that is not an object', () => {
    expect(() =>
      chainEvent({ payload: [] as unknown as Record<string, unknown> }),
    ).toThrow();
  });

  it('cannot be altered through the payload passed at construction', () => {
    const payload: Record<string, unknown> = { sizeBytes: 12345 };
    const event = chainEvent({ payload });

    payload.sizeBytes = 999;

    expect(event.payload).toEqual({ sizeBytes: 12345 });
  });

  it('cannot be altered through the payload it hands back', () => {
    const event = chainEvent();

    event.payload.sizeBytes = 999;

    expect(event.payload.sizeBytes).toBe(12345);
  });

  it('cannot be altered through the date it hands back', () => {
    const event = chainEvent();

    event.occurredAt.setFullYear(1999);

    expect(event.occurredAt.toISOString()).toBe('2026-08-02T10:00:00.000Z');
  });

  it('round-trips through its primitives', () => {
    const event = chainEvent();

    expect(
      AuditEvent.reconstitute(event.toPrimitives()).toPrimitives(),
    ).toEqual(event.toPrimitives());
  });

  it('rejects a stored event whose type left the catalogue', () => {
    const stored = chainEvent().toPrimitives();

    expect(() =>
      AuditEvent.reconstitute({
        ...stored,
        eventType: 'TRACE_LOOKED_AT' as AuditEventTypeEnum,
      }),
    ).toThrow();
  });
});
