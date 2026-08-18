import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../../domain/audit-event/entity/audit-event';
import { computeEventHash } from '../../../domain/services/audit-event-hash';
import { InMemoryChainAnchorStore } from '../../../infrastructure/persistence/in-memory-chain-anchor.store';
import { InMemoryChainEventReader } from '../../../infrastructure/persistence/in-memory-chain-event.reader';
import { InMemoryTimestampVerifier } from '../../../infrastructure/tsa/in-memory-timestamp.verifier';
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
  let anchors: InMemoryChainAnchorStore;
  let timestampVerifier: InMemoryTimestampVerifier;

  beforeEach(() => {
    reader = new InMemoryChainEventReader();
    anchors = new InMemoryChainAnchorStore();
    timestampVerifier = new InMemoryTimestampVerifier();
    handler = new VerifyChainHandler(reader, anchors, timestampVerifier);
  });

  const NO_ANCHOR = { verified: 0, failed: 0 };

  it('conclut intègre sur une chaîne vide', async () => {
    const report = await handler.execute();

    expect(report).toEqual({ ok: true, eventsChecked: 0, anchors: NO_ANCHOR });
  });

  it('conclut intègre sur une chaîne continue', async () => {
    reader.store.push(...intactChain(3));

    const report = await handler.execute();

    expect(report).toEqual({ ok: true, eventsChecked: 3, anchors: NO_ANCHOR });
  });

  it('pointe le maillon dont le payload a été retouché', async () => {
    const rows = intactChain(3);
    rows[1].payload = { caseNumber: 'AFF-falsifié' };
    reader.store.push(...rows);

    const report = await handler.execute();

    expect(report).toEqual({
      ok: false,
      eventsChecked: 1,
      firstBrokenSeq: 2,
      anchors: NO_ANCHOR,
    });
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

    expect(report).toEqual({
      ok: false,
      eventsChecked: 1,
      firstBrokenSeq: 3,
      anchors: NO_ANCHOR,
    });
  });

  it('détecte une chaîne qui ne commence pas au genesis', async () => {
    reader.store.push(...intactChain(2).slice(1));

    const report = await handler.execute();

    expect(report).toEqual({
      ok: false,
      eventsChecked: 0,
      firstBrokenSeq: 2,
      anchors: NO_ANCHOR,
    });
  });

  it('sort en rupture, pas en exception, sur un acteur illisible', async () => {
    const rows = intactChain(1);
    rows[0].actor = { ...rows[0].actor, displayName: '' };
    reader.store.push(...rows);

    const report = await handler.execute();

    expect(report).toEqual({
      ok: false,
      eventsChecked: 0,
      firstBrokenSeq: 1,
      anchors: NO_ANCHOR,
    });
  });
  describe('ancres', () => {
    function anchorOn(row: ChainEventRow, headHash = row.hash) {
      return {
        headSeq: row.seq,
        headHash,
        tsaUrl: 'https://freetsa.org/tsr',
        tsaResponse: Buffer.from('tsr'),
        anchoredAt: new Date('2026-08-18T22:00:00.000Z'),
      };
    }

    it('valide une ancre reliée à la chaîne et horodatant ce maillon', async () => {
      const rows = intactChain(2);
      reader.store.push(...rows);
      anchors.store.push(anchorOn(rows[1]));

      const report = await handler.execute();

      expect(report.ok).toBe(true);
      expect(report.anchors).toEqual({ verified: 1, failed: 0 });
      expect(timestampVerifier.verified).toHaveLength(1);
    });

    it('refuse une ancre qui désigne un maillon absent de la chaîne', async () => {
      const rows = intactChain(2);
      reader.store.push(...rows);
      anchors.store.push({ ...anchorOn(rows[1]), headSeq: 9n });

      const report = await handler.execute();

      expect(report.ok).toBe(false);
      expect(report.anchors).toEqual({ verified: 0, failed: 1 });
    });

    it("refuse une ancre dont le hash n'est pas celui du maillon ancré", async () => {
      const rows = intactChain(2);
      reader.store.push(...rows);
      anchors.store.push(anchorOn(rows[1], '0'.repeat(64)));

      const report = await handler.execute();

      expect(report.ok).toBe(false);
      expect(report.anchors).toEqual({ verified: 0, failed: 1 });
    });

    it("refuse un TSR qui n'horodate pas le maillon ancré", async () => {
      const rows = intactChain(2);
      reader.store.push(...rows);
      anchors.store.push(anchorOn(rows[1]));
      timestampVerifier.accept = false;

      const report = await handler.execute();

      expect(report.ok).toBe(false);
      expect(report.anchors).toEqual({ verified: 0, failed: 1 });
    });

    it('détecte une chaîne tronquée sous la dernière ancre', async () => {
      const rows = intactChain(3);
      reader.store.push(rows[0]);
      anchors.store.push(anchorOn(rows[2]));

      const report = await handler.execute();

      expect(report.ok).toBe(false);
      expect(report.truncatedBelowSeq).toBe(3);
    });
  });
});
