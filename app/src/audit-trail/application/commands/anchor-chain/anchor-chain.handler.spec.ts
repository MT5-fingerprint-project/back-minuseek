import { createHash } from 'node:crypto';
import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { computeEventHash } from '../../../domain/services/audit-event-hash';
import { InMemoryAuditTrailAppender } from '../../../infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryChainAnchorStore } from '../../../infrastructure/persistence/in-memory-chain-anchor.store';
import { InMemoryChainEventReader } from '../../../infrastructure/persistence/in-memory-chain-event.reader';
import { InMemoryTsaAdapter } from '../../../infrastructure/tsa/in-memory-tsa.adapter';
import { ChainEventRow } from '../../queries/verify-chain/chain-event.reader';
import { AnchorChainHandler } from './anchor-chain.handler';

const ACTOR = AuditActor.system('provisioner');
const GEN_TIME = new Date('2026-08-18T22:00:00.000Z');

function chainRow(seq: bigint, eventType: AuditEventTypeEnum): ChainEventRow {
  const row = {
    seq,
    eventType,
    evidenceClass: EvidenceClassEnum.OBSERVED,
    actor: ACTOR.toPrimitives(),
    caseId: null,
    traceId: null,
    payload: {},
    occurredAt: GEN_TIME,
    prevHash: '0'.repeat(64),
  };
  return { ...row, hash: computeEventHash({ ...row, actor: ACTOR }) };
}

describe('AnchorChainHandler', () => {
  let handler: AnchorChainHandler;
  let reader: InMemoryChainEventReader;
  let anchors: InMemoryChainAnchorStore;
  let tsa: InMemoryTsaAdapter;
  let appender: InMemoryAuditTrailAppender;

  beforeEach(() => {
    reader = new InMemoryChainEventReader();
    anchors = new InMemoryChainAnchorStore();
    tsa = new InMemoryTsaAdapter(GEN_TIME);
    appender = new InMemoryAuditTrailAppender();
    handler = new AnchorChainHandler(
      reader,
      anchors,
      tsa,
      new InMemoryTransactionRunner(),
      appender,
      { generate: () => 'anchor-uuid' },
    );
  });

  it("n'ancre pas une chaîne vide", async () => {
    const outcome = await handler.execute();

    expect(outcome).toEqual({ status: 'skipped', reason: 'chaîne vide' });
    expect(tsa.requested).toHaveLength(0);
    expect(anchors.store).toHaveLength(0);
  });

  it('horodate la tête et chaîne un CHAIN_ANCHORED', async () => {
    const head = chainRow(2n, AuditEventTypeEnum.CASE_OPENED);
    reader.store.push(
      chainRow(1n, AuditEventTypeEnum.TENANT_PROVISIONED),
      head,
    );

    const outcome = await handler.execute();

    expect(outcome).toEqual({
      status: 'anchored',
      headSeq: 2,
      genTime: GEN_TIME,
    });
    expect(tsa.requested).toEqual([head.hash]);
    expect(anchors.store).toEqual([
      {
        headSeq: 2n,
        headHash: head.hash,
        tsaUrl: 'in-memory://tsa',
        tsaResponse: createHash('sha256').update(head.hash).digest(),
        anchoredAt: GEN_TIME,
      },
    ]);
    expect(appender.events).toHaveLength(1);
    expect(appender.events[0].eventType).toBe(
      AuditEventTypeEnum.CHAIN_ANCHORED,
    );
    expect(appender.events[0].payload).toEqual({
      headSeq: 2,
      headHash: head.hash,
      tsaUrl: 'in-memory://tsa',
      tsrSha256: createHash('sha256')
        .update(createHash('sha256').update(head.hash).digest())
        .digest('hex'),
    });
  });

  it("ne s'auto-relance pas quand la tête est le CHAIN_ANCHORED de la dernière ancre", async () => {
    const anchored = chainRow(2n, AuditEventTypeEnum.CASE_OPENED);
    reader.store.push(
      anchored,
      chainRow(3n, AuditEventTypeEnum.CHAIN_ANCHORED),
    );
    await anchors.save({
      id: 'anchor-1',
      headSeq: 2n,
      headHash: anchored.hash,
      tsaUrl: 'in-memory://tsa',
      tsaResponse: Buffer.from('tsr'),
      anchoredAt: GEN_TIME,
    });

    const outcome = await handler.execute();

    expect(outcome).toEqual({
      status: 'skipped',
      reason: 'rien de neuf depuis la dernière ancre',
    });
    expect(tsa.requested).toHaveLength(0);
  });

  it('ré-ancre dès qu un événement métier s ajoute après le CHAIN_ANCHORED', async () => {
    const anchored = chainRow(2n, AuditEventTypeEnum.CASE_OPENED);
    reader.store.push(
      anchored,
      chainRow(3n, AuditEventTypeEnum.CHAIN_ANCHORED),
      chainRow(4n, AuditEventTypeEnum.LAYER_CREATED),
    );
    await anchors.save({
      id: 'anchor-1',
      headSeq: 2n,
      headHash: anchored.hash,
      tsaUrl: 'in-memory://tsa',
      tsaResponse: Buffer.from('tsr'),
      anchoredAt: GEN_TIME,
    });

    const outcome = await handler.execute();

    expect(outcome).toMatchObject({ status: 'anchored', headSeq: 4 });
  });

  it("n'écrit rien quand la TSA est en échec", async () => {
    reader.store.push(chainRow(1n, AuditEventTypeEnum.TENANT_PROVISIONED));
    tsa.failure = new Error('TSA injoignable');

    await expect(handler.execute()).rejects.toThrow('TSA injoignable');
    expect(anchors.store).toHaveLength(0);
    expect(appender.events).toHaveLength(0);
  });
});
