import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../../domain/audit-event/entity/audit-event';
import { computeEventHash } from '../../../domain/services/audit-event-hash';
import { InMemoryChainEventReader } from '../../../infrastructure/persistence/in-memory-chain-event.reader';
import { ChainEventRow } from './chain-event.reader';
import { VerifyChainHandler } from './verify-chain.handler';

const ACTOR = AuditActor.system('provisioner');

function chainRow(seq: bigint, prevHash: string): ChainEventRow {
  const row = {
    seq,
    eventType: AuditEventTypeEnum.CASE_OPENED,
    evidenceClass: EvidenceClassEnum.OBSERVED,
    actor: ACTOR.toPrimitives(),
    caseId: null,
    traceId: null,
    payload: { caseNumber: `AFF-${seq}` },
    occurredAt: new Date('2026-08-18T10:00:00.000Z'),
    prevHash,
  };
  return {
    ...row,
    hash: computeEventHash({ ...row, actor: ACTOR }),
  };
}

function intactChain(length: number): ChainEventRow[] {
  const rows: ChainEventRow[] = [];
  let prevHash = GENESIS_PREV_HASH;
  for (let index = 0; index < length; index++) {
    const row = chainRow(GENESIS_SEQ + BigInt(index), prevHash);
    rows.push(row);
    prevHash = row.hash;
  }
  return rows;
}

describe('VerifyChainHandler', () => {
  let handler: VerifyChainHandler;
  let reader: InMemoryChainEventReader;

  beforeEach(() => {
    reader = new InMemoryChainEventReader();
    handler = new VerifyChainHandler(reader);
  });

  it('conclut intègre sur une chaîne vide', async () => {
    const report = await handler.execute();

    expect(report).toEqual({ ok: true, eventsChecked: 0 });
  });

  it('conclut intègre sur une chaîne continue', async () => {
    reader.store.push(...intactChain(3));

    const report = await handler.execute();

    expect(report).toEqual({ ok: true, eventsChecked: 3 });
  });

  it('pointe le maillon dont le payload a été retouché', async () => {
    const rows = intactChain(3);
    rows[1].payload = { caseNumber: 'AFF-falsifié' };
    reader.store.push(...rows);

    const report = await handler.execute();

    expect(report).toEqual({ ok: false, eventsChecked: 1, firstBrokenSeq: 2 });
  });

  it('pointe le maillon dont le prevHash ne suit pas', async () => {
    const rows = intactChain(3);
    rows[2].prevHash = GENESIS_PREV_HASH;
    reader.store.push(...rows);

    const report = await handler.execute();

    expect(report.ok).toBe(false);
    expect(report.firstBrokenSeq).toBe(3);
  });

  it('détecte un trou dans les seq', async () => {
    const rows = intactChain(3);
    reader.store.push(rows[0], rows[2]);

    const report = await handler.execute();

    expect(report).toEqual({ ok: false, eventsChecked: 1, firstBrokenSeq: 3 });
  });

  it('détecte une chaîne qui ne commence pas au genesis', async () => {
    reader.store.push(...intactChain(2).slice(1));

    const report = await handler.execute();

    expect(report).toEqual({ ok: false, eventsChecked: 0, firstBrokenSeq: 2 });
  });

  it('sort en rupture, pas en exception, sur un acteur illisible', async () => {
    const rows = intactChain(1);
    rows[0].actor = { ...rows[0].actor, displayName: '' };
    reader.store.push(...rows);

    const report = await handler.execute();

    expect(report).toEqual({ ok: false, eventsChecked: 0, firstBrokenSeq: 1 });
  });
});
