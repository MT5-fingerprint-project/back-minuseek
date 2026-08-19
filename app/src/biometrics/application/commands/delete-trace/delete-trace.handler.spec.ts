import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { TransactionRunner } from '../../../../shared/domain/ports/transaction-runner';
import { DeleteTraceCommand } from './delete-trace.command';
import { DeleteTraceHandler } from './delete-trace.handler';

const STORED_PATH = 'media/investigation-case/case-1/traces/trace-1.png';

class RollingBackTransactionRunner implements TransactionRunner {
  constructor(private readonly failure: Error) {}

  run<T>(): Promise<T> {
    return Promise.reject(this.failure);
  }
}

describe('DeleteTraceHandler', () => {
  let handler: DeleteTraceHandler;
  let repo: InMemoryTraceRepository;
  let storage: InMemoryImageStorageAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let transactionRunner: InMemoryTransactionRunner;

  const buildHandler = (runner: TransactionRunner) =>
    new DeleteTraceHandler(repo, storage, runner, auditTrail);

  beforeEach(async () => {
    repo = new InMemoryTraceRepository();
    storage = new InMemoryImageStorageAdapter();
    auditTrail = new InMemoryAuditTrailAppender();
    transactionRunner = new InMemoryTransactionRunner();
    handler = buildHandler(transactionRunner);

    await repo.save(
      Trace.upload({
        id: 'trace-1',
        path: STORED_PATH,
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
    await storage.save(
      Buffer.from('bytes'),
      'investigation-case/case-1/traces/trace-1.png',
    );
  });

  it('removes the trace and its stored object', async () => {
    await handler.execute(new DeleteTraceCommand(EXPERT_ACTOR, 'trace-1'));

    expect(await repo.findById('trace-1')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-1/traces/trace-1.png'),
    ).toBeUndefined();
  });

  it('deletes the archived TIFF original next to the displayable PNG', async () => {
    await storage.save(
      Buffer.from('tif'),
      'investigation-case/case-1/traces/trace-1_original.tif',
    );

    await handler.execute(new DeleteTraceCommand(EXPERT_ACTOR, 'trace-1'));

    expect(
      storage.getSaved('investigation-case/case-1/traces/trace-1_original.tif'),
    ).toBeUndefined();
  });

  it('deletes a non-TIFF upload without failing on the missing archive', async () => {
    await storage.save(
      Buffer.from('jpg'),
      'investigation-case/case-1/traces/trace-2.jpg',
    );
    await repo.save(
      Trace.upload({
        id: 'trace-2',
        path: 'media/investigation-case/case-1/traces/trace-2.jpg',
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );

    await handler.execute(new DeleteTraceCommand(EXPERT_ACTOR, 'trace-2'));

    expect(await repo.findById('trace-2')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-1/traces/trace-2.jpg'),
    ).toBeUndefined();
  });

  it('chains a TRACE_DELETED event naming the actor and the seal of what disappeared', async () => {
    await handler.execute(
      new DeleteTraceCommand(EXPERT_ACTOR, 'trace-1', 'doublon du scan'),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_DELETED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      storagePath: STORED_PATH,
      fileSha256: ANY_SEAL.getValue(),
      reason: 'doublon du scan',
    });
  });

  it('records a deletion without a stated reason as such', async () => {
    await handler.execute(new DeleteTraceCommand(EXPERT_ACTOR, 'trace-1'));

    expect(auditTrail.events[0].payload).toMatchObject({ reason: null });
  });

  it('removes the row and its link in a single transaction', async () => {
    await handler.execute(new DeleteTraceCommand(EXPERT_ACTOR, 'trace-1'));

    expect(transactionRunner.runCount).toBe(1);
  });

  it('keeps the stored object when the transaction fails', async () => {
    const failure = new Error('rollback');

    await expect(
      buildHandler(new RollingBackTransactionRunner(failure)).execute(
        new DeleteTraceCommand(EXPERT_ACTOR, 'trace-1'),
      ),
    ).rejects.toBe(failure);

    expect(
      storage.getSaved('investigation-case/case-1/traces/trace-1.png'),
    ).toBeDefined();
  });

  it('chains nothing when the trace does not exist', async () => {
    await expect(
      handler.execute(new DeleteTraceCommand(EXPERT_ACTOR, 'missing')),
    ).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });
});
