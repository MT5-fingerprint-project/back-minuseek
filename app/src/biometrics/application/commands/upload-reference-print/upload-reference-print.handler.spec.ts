import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { TransactionRunner } from '../../../../shared/domain/ports/transaction-runner';
import { UploadReferencePrintCommand } from './upload-reference-print.command';
import { UploadReferencePrintHandler } from './upload-reference-print.handler';

const CLEAN_PRINT_SHA256 =
  '70ccc2a604c5f59ed11bdd4b2eb82763359189b62487cb0326c1a05b07769665';
const STORED_PATH =
  'media/investigation-case/case-9/reference-prints/ref-456.tiff';

class RollingBackTransactionRunner implements TransactionRunner {
  constructor(private readonly failure: Error) {}

  run<T>(): Promise<T> {
    return Promise.reject(this.failure);
  }
}

describe('UploadReferencePrintHandler', () => {
  let handler: UploadReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let storage: InMemoryImageStorageAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let transactionRunner: InMemoryTransactionRunner;
  let idGenerator: IdGenerator;

  const buildHandler = (runner: TransactionRunner) =>
    new UploadReferencePrintHandler(
      repo,
      storage,
      idGenerator,
      runner,
      auditTrail,
    );

  beforeEach(() => {
    repo = new InMemoryReferencePrintRepository();
    storage = new InMemoryImageStorageAdapter();
    auditTrail = new InMemoryAuditTrailAppender();
    transactionRunner = new InMemoryTransactionRunner();
    idGenerator = { generate: jest.fn().mockReturnValue('ref-456') };
    handler = buildHandler(transactionRunner);
  });

  const command = () =>
    new UploadReferencePrintCommand(
      EXPERT_ACTOR,
      Buffer.from('clean-print'),
      'thumb.tiff',
      'image/tiff',
      'case-9',
    );

  it('stores the file under media/{caseId}/reference-prints, persists the reference print and returns id, path and url', async () => {
    const result = await handler.execute(command());

    expect(result).toEqual({
      id: 'ref-456',
      path: STORED_PATH,
      url: `/${STORED_PATH}`,
    });

    const saved = await repo.findById('ref-456');
    expect(saved?.path).toBe(STORED_PATH);
    expect(saved?.caseId).toBe('case-9');

    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.tiff')
        ?.toString(),
    ).toBe('clean-print');
  });

  it('seals the deposited bytes on the reference print', async () => {
    await handler.execute(command());

    expect((await repo.findById('ref-456'))?.sha256).toBe(CLEAN_PRINT_SHA256);
  });

  it('chains a REFERENCE_PRINT_UPLOADED event carrying the seal of the deposit', async () => {
    await handler.execute(command());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBeNull();
    expect(event.payload).toEqual({
      referencePrintId: 'ref-456',
      fileSha256: CLEAN_PRINT_SHA256,
      storagePath: STORED_PATH,
      sizeBytes: 11,
      mimeType: 'image/tiff',
    });
  });

  it('writes the reference print and its link inside a single transaction', async () => {
    await handler.execute(command());

    expect(transactionRunner.runCount).toBe(1);
  });

  it('deletes the stored file and rethrows when the transaction fails', async () => {
    const failure = new Error('rollback');

    await expect(
      buildHandler(new RollingBackTransactionRunner(failure)).execute(
        command(),
      ),
    ).rejects.toBe(failure);

    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.tiff',
      ),
    ).toBeUndefined();
  });

  it('keeps the upload when the compensating delete itself fails', async () => {
    const failure = new Error('rollback');
    jest
      .spyOn(storage, 'delete')
      .mockRejectedValue(new Error('storage unreachable'));

    await expect(
      buildHandler(new RollingBackTransactionRunner(failure)).execute(
        command(),
      ),
    ).rejects.toBe(failure);
  });
});
