import type { Prisma } from '../../../../generated/prisma/client';
import { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import { AuditEventDraft } from '../../../shared/domain/ports/audit-trail.port';
import {
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../domain/audit-event/entity/audit-event';
import { computeEventHash } from '../../domain/services/audit-event-hash';
import { TransactionContextService } from '../../../tenancy/infrastructure/persistence/transaction-context.service';
import { AuditAppendOutsideTransactionError } from './audit-append-outside-transaction.error';
import { PrismaAuditTrailAppender } from './prisma-audit-trail.appender';

interface InsertedAuditEventRow {
  id: string;
  seq: bigint;
  eventType: string;
  evidenceClass: string;
  actor: { type: string; sub: string; username: string; displayName: string };
  payload: Record<string, unknown>;
  caseId: string | null;
  traceId: string | null;
  occurredAt: Date;
  prevHash: string;
  hash: string;
}

interface ChainHead {
  seq: bigint;
  hash: string;
}

class FakeTransactionClient {
  readonly operations: string[] = [];
  readonly insertedRows: InsertedAuditEventRow[] = [];

  constructor(private readonly head: ChainHead | null = null) {}

  $queryRaw(): Promise<unknown> {
    this.operations.push('advisory-lock');
    return Promise.resolve([]);
  }

  readonly auditEvent = {
    findFirst: (): Promise<ChainHead | null> => {
      this.operations.push('read-head');
      return Promise.resolve(this.head);
    },
    create: (args: { data: InsertedAuditEventRow }): Promise<unknown> => {
      this.operations.push('insert');
      this.insertedRows.push(args.data);
      return Promise.resolve(args.data);
    },
  };
}

const EXPERT = AuditActor.user({
  sub: 'kc-sub-42',
  username: 'jdupont',
  displayName: 'Jean Dupont',
});

const DRAFT: AuditEventDraft = {
  eventType: AuditEventTypeEnum.CASE_OPENED,
  evidenceClass: EvidenceClassEnum.OBSERVED,
  actor: EXPERT,
  caseId: '6f1e7c1a-0000-4000-8000-000000000042',
  payload: { caseNumber: 'AFF-001' },
};

function buildAppender(head: ChainHead | null = null) {
  const transactionClient = new FakeTransactionClient(head);
  const transactionContext = new TransactionContextService();
  const appender = new PrismaAuditTrailAppender(transactionContext, {
    generate: () => 'audit-event-uuid',
  });
  const appendInTransaction = (draft: AuditEventDraft) =>
    transactionContext.run(
      transactionClient as unknown as Prisma.TransactionClient,
      () => appender.append(draft),
    );
  return { appender, transactionClient, appendInTransaction };
}

describe('PrismaAuditTrailAppender', () => {
  it('refuse un append hors de toute transaction', async () => {
    const { appender } = buildAppender();

    await expect(appender.append(DRAFT)).rejects.toThrow(
      AuditAppendOutsideTransactionError,
    );
  });

  it('écrit le genesis quand la chaîne est vide', async () => {
    const { transactionClient, appendInTransaction } = buildAppender();

    await appendInTransaction(DRAFT);

    const [row] = transactionClient.insertedRows;
    expect(row.seq).toBe(GENESIS_SEQ);
    expect(row.prevHash).toBe(GENESIS_PREV_HASH);
  });

  it('chaîne sur la tête existante (seq + 1, prevHash = hash de tête)', async () => {
    const head: ChainHead = { seq: 41n, hash: 'a'.repeat(64) };
    const { transactionClient, appendInTransaction } = buildAppender(head);

    await appendInTransaction(DRAFT);

    const [row] = transactionClient.insertedRows;
    expect(row.seq).toBe(42n);
    expect(row.prevHash).toBe(head.hash);
  });

  it('prend le verrou consultatif avant de lire la tête, puis insère', async () => {
    const { transactionClient, appendInTransaction } = buildAppender();

    await appendInTransaction(DRAFT);

    expect(transactionClient.operations).toEqual([
      'advisory-lock',
      'read-head',
      'insert',
    ]);
  });

  it('le hash inséré est recalculable depuis les champs de la ligne', async () => {
    const { transactionClient, appendInTransaction } = buildAppender();

    await appendInTransaction(DRAFT);

    const [row] = transactionClient.insertedRows;
    expect(row.hash).toBe(
      computeEventHash({
        seq: row.seq,
        eventType: DRAFT.eventType,
        evidenceClass: DRAFT.evidenceClass,
        actor: EXPERT,
        caseId: row.caseId,
        traceId: row.traceId,
        payload: row.payload,
        occurredAt: row.occurredAt,
        prevHash: row.prevHash,
      }),
    );
  });

  it("horodate côté serveur et prend l'id du générateur", async () => {
    const before = Date.now();
    const { transactionClient, appendInTransaction } = buildAppender();

    await appendInTransaction(DRAFT);

    const [row] = transactionClient.insertedRows;
    expect(row.id).toBe('audit-event-uuid');
    expect(row.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(row.occurredAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('normalise les identifiants absents en null', async () => {
    const { transactionClient, appendInTransaction } = buildAppender();

    await appendInTransaction({
      eventType: AuditEventTypeEnum.TENANT_PROVISIONED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: AuditActor.system('provisioner'),
      payload: { slug: 'tenant-demo' },
    });

    const [row] = transactionClient.insertedRows;
    expect(row.caseId).toBeNull();
    expect(row.traceId).toBeNull();
  });

  it("persiste le snapshot de l'acteur et le payload", async () => {
    const { transactionClient, appendInTransaction } = buildAppender();

    await appendInTransaction(DRAFT);

    const [row] = transactionClient.insertedRows;
    expect(row.actor).toEqual(EXPERT.toPrimitives());
    expect(row.payload).toEqual({ caseNumber: 'AFF-001' });
    expect(row.eventType).toBe(AuditEventTypeEnum.CASE_OPENED);
    expect(row.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
  });
});
