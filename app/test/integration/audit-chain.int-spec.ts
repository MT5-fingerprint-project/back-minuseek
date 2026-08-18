import { randomUUID } from 'node:crypto';
import { GENESIS_PREV_HASH } from '../../src/audit-trail/domain/audit-event/entity/audit-event';
import { EXPERT_ACTOR } from '../../src/shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../src/shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../src/shared/domain/audit/evidence-class.vo';
import { UnauditedMutationError } from '../../src/tenancy/infrastructure/persistence/unaudited-mutation.error';
import {
  AuditChainHarness,
  openAuditChainHarness,
} from './support/audit-chain-harness';

// use multiple concurrent uploads to test the advisory lock and audit chain integrity
const CONCURRENT_UPLOADS = 8;

const CASE_ID = '11111111-1111-4111-8111-111111111111';

class WorkFailedError extends Error {}

describe("chaîne d'audit contre un vrai Postgres", () => {
  let harness: AuditChainHarness;

  beforeAll(async () => {
    harness = await openAuditChainHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.database.reset();
  });

  function uploadTrace(index: number, then?: () => never): Promise<void> {
    const traceId = randomUUID();
    return harness.asTenant(() =>
      harness.runner.run(async () => {
        const client = await harness.connection.getCurrentClient();
        await client.trace.create({
          data: { id: traceId, path: `traces/${index}.png`, caseId: CASE_ID },
        });
        await harness.appender.append({
          eventType: AuditEventTypeEnum.TRACE_UPLOADED,
          evidenceClass: EvidenceClassEnum.OBSERVED,
          actor: EXPERT_ACTOR,
          caseId: CASE_ID,
          traceId,
          payload: { path: `traces/${index}.png` },
        });
        if (then) {
          then();
        }
      }),
    );
  }

  it('sérialise des appends concurrents en une chaîne contiguë, sans fourche', async () => {
    await Promise.all(
      Array.from({ length: CONCURRENT_UPLOADS }, (_, index) =>
        uploadTrace(index),
      ),
    );

    const events = await harness.database.client.auditEvent.findMany({
      orderBy: { seq: 'asc' },
      select: { seq: true, prevHash: true, hash: true },
    });

    expect(events).toHaveLength(CONCURRENT_UPLOADS);
    expect(events.map((event) => event.seq)).toEqual(
      Array.from({ length: CONCURRENT_UPLOADS }, (_, index) =>
        BigInt(index + 1),
      ),
    );

    let expectedPrevHash = GENESIS_PREV_HASH;
    for (const event of events) {
      expect(event.prevHash).toBe(expectedPrevHash);
      expectedPrevHash = event.hash;
    }

    const hashes = new Set(events.map((event) => event.hash));
    expect(hashes.size).toBe(CONCURRENT_UPLOADS);

    await expect(harness.database.client.trace.count()).resolves.toBe(
      CONCURRENT_UPLOADS,
    );
  });

  it("n'écrit ni la ligne métier ni le maillon quand le travail échoue", async () => {
    await expect(
      uploadTrace(0, () => {
        throw new WorkFailedError();
      }),
    ).rejects.toThrow(WorkFailedError);

    await expect(harness.database.client.trace.count()).resolves.toBe(0);
    await expect(harness.database.client.auditEvent.count()).resolves.toBe(0);
  });

  it('laisse la chaîne repartir de la tête après un échec', async () => {
    await uploadTrace(0);
    await expect(
      uploadTrace(1, () => {
        throw new WorkFailedError();
      }),
    ).rejects.toThrow(WorkFailedError);
    await uploadTrace(2);

    const events = await harness.database.client.auditEvent.findMany({
      orderBy: { seq: 'asc' },
      select: { seq: true, prevHash: true, hash: true },
    });

    expect(events.map((event) => event.seq)).toEqual([1n, 2n]);
    expect(events[1].prevHash).toBe(events[0].hash);
  });

  it('refuse une mutation métier non chaînée et annule la transaction', async () => {
    const unchainedUpload = harness.asTenant(() =>
      harness.runner.run(async () => {
        const client = await harness.connection.getCurrentClient();
        await client.trace.create({
          data: {
            id: randomUUID(),
            path: 'traces/unchained.png',
            caseId: CASE_ID,
          },
        });
      }),
    );

    await expect(unchainedUpload).rejects.toThrow(UnauditedMutationError);
    await expect(unchainedUpload).rejects.toThrow(/Trace/);
    await expect(harness.database.client.trace.count()).resolves.toBe(0);
  });

  it('laisse passer une mutation sur une table encore exemptée', async () => {
    await harness.asTenant(() =>
      harness.runner.run(async () => {
        const client = await harness.connection.getCurrentClient();
        await client.investigationCase.create({
          data: { id: CASE_ID, caseNumber: 'PJ-2026-001', pvNumber: 'PV-001' },
        });
      }),
    );

    await expect(
      harness.database.client.investigationCase.count(),
    ).resolves.toBe(1);
    await expect(harness.database.client.auditEvent.count()).resolves.toBe(0);
  });
});
