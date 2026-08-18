import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { TransactionRunner } from '../../../../shared/domain/ports/transaction-runner';
import { DeleteReferencePrintCommand } from './delete-reference-print.command';
import { DeleteReferencePrintHandler } from './delete-reference-print.handler';

const STORED_PATH =
  'media/investigation-case/case-1/reference-prints/ref-1.png';

class RollingBackTransactionRunner implements TransactionRunner {
  constructor(private readonly failure: Error) {}

  run<T>(): Promise<T> {
    return Promise.reject(this.failure);
  }
}

describe('DeleteReferencePrintHandler', () => {
  let handler: DeleteReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let storage: InMemoryImageStorageAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let transactionRunner: InMemoryTransactionRunner;

  const buildHandler = (runner: TransactionRunner) =>
    new DeleteReferencePrintHandler(repo, storage, runner, auditTrail);

  beforeEach(async () => {
    repo = new InMemoryReferencePrintRepository();
    storage = new InMemoryImageStorageAdapter();
    auditTrail = new InMemoryAuditTrailAppender();
    transactionRunner = new InMemoryTransactionRunner();
    handler = buildHandler(transactionRunner);

    await repo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: STORED_PATH,
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
    await storage.save(
      Buffer.from('bytes'),
      'investigation-case/case-1/reference-prints/ref-1.png',
    );
  });

  it('removes the reference print and its stored object', async () => {
    await handler.execute(
      new DeleteReferencePrintCommand(EXPERT_ACTOR, 'ref-1'),
    );

    expect(await repo.findById('ref-1')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-1/reference-prints/ref-1.png'),
    ).toBeUndefined();
  });

  it('chains a REFERENCE_PRINT_DELETED event naming the actor and the seal of what disappeared', async () => {
    await handler.execute(
      new DeleteReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 'mauvais sujet'),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.REFERENCE_PRINT_DELETED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.payload).toEqual({
      referencePrintId: 'ref-1',
      storagePath: STORED_PATH,
      fileSha256: ANY_SEAL.getValue(),
      reason: 'mauvais sujet',
    });
  });

  it('removes the row and its link in a single transaction', async () => {
    await handler.execute(
      new DeleteReferencePrintCommand(EXPERT_ACTOR, 'ref-1'),
    );

    expect(transactionRunner.runCount).toBe(1);
  });

  it('keeps the stored object when the transaction fails', async () => {
    const failure = new Error('rollback');

    await expect(
      buildHandler(new RollingBackTransactionRunner(failure)).execute(
        new DeleteReferencePrintCommand(EXPERT_ACTOR, 'ref-1'),
      ),
    ).rejects.toBe(failure);

    expect(
      storage.getSaved('investigation-case/case-1/reference-prints/ref-1.png'),
    ).toBeDefined();
  });

  it('chains nothing when the reference print does not exist', async () => {
    await expect(
      handler.execute(new DeleteReferencePrintCommand(EXPERT_ACTOR, 'missing')),
    ).rejects.toBeInstanceOf(ReferencePrintNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });
});
