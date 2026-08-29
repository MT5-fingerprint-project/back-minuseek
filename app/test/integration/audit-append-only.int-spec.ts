import { Prisma } from '../../generated/prisma/client';
import { EXPERT_ACTOR } from '../../src/shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../src/shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../src/shared/domain/audit/evidence-class.vo';
import {
  AuditChainHarness,
  openAuditChainHarness,
} from './support/audit-chain-harness';

const CASE_ID = '22222222-2222-4222-8222-222222222222';

const DISABLE_TRIGGER =
  'ALTER TABLE "AuditEvent" DISABLE TRIGGER audit_event_append_only';
const ENABLE_TRIGGER =
  'ALTER TABLE "AuditEvent" ENABLE TRIGGER audit_event_append_only';

describe('AuditEvent est append-only au niveau Postgres', () => {
  let harness: AuditChainHarness;

  beforeAll(async () => {
    harness = await openAuditChainHarness();
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.database.reset();
    await appendEvent();
  });

  function appendEvent(): Promise<unknown> {
    return harness.asTenant(() =>
      harness.runner.run(() =>
        harness.appender.append({
          eventType: AuditEventTypeEnum.CASE_OPENED,
          evidenceClass: EvidenceClassEnum.OBSERVED,
          actor: EXPERT_ACTOR,
          caseId: CASE_ID,
          payload: { caseNumber: 'PJ-2026-001' },
        }),
      ),
    );
  }

  it('refuse un UPDATE et laisse le maillon intact', async () => {
    const before = await harness.database.client.auditEvent.findFirstOrThrow();

    const corruption = harness.database.client.$executeRawUnsafe(
      `UPDATE "AuditEvent" SET payload = '{}'::jsonb WHERE seq = 1`,
    );

    await expect(corruption).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(corruption).rejects.toThrow(/append-only/);

    const after = await harness.database.client.auditEvent.findFirstOrThrow();
    expect(after.payload).toEqual(before.payload);
    expect(after.hash).toBe(before.hash);
  });

  it('refuse un DELETE et laisse le maillon en place', async () => {
    const deletion = harness.database.client.$executeRawUnsafe(
      `DELETE FROM "AuditEvent" WHERE seq = 1`,
    );

    await expect(deletion).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(deletion).rejects.toThrow(/append-only/);
    await expect(harness.database.client.auditEvent.count()).resolves.toBe(1);
  });

  it("laisse passer l'append, qui reste la seule écriture permise", async () => {
    await appendEvent();

    const events = await harness.database.client.auditEvent.findMany({
      orderBy: { seq: 'asc' },
      select: { seq: true },
    });
    expect(events.map((event) => event.seq)).toEqual([1n, 2n]);
  });

  it('se laisse désactiver explicitement, pour les corruptions volontaires des tests de vérification', async () => {
    await harness.database.client.$executeRawUnsafe(DISABLE_TRIGGER);
    try {
      await harness.database.client.$executeRawUnsafe(
        `UPDATE "AuditEvent" SET payload = '{"corrompu": true}'::jsonb WHERE seq = 1`,
      );
    } finally {
      await harness.database.client.$executeRawUnsafe(ENABLE_TRIGGER);
    }

    const corrupted =
      await harness.database.client.auditEvent.findFirstOrThrow();
    expect(corrupted.payload).toEqual({ corrompu: true });

    await expect(
      harness.database.client.$executeRawUnsafe(
        `UPDATE "AuditEvent" SET payload = '{}'::jsonb WHERE seq = 1`,
      ),
    ).rejects.toThrow(/append-only/);
  });
});
