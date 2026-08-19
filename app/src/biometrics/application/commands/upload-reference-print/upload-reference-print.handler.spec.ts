import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryImageConverter } from '../../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InvalidImageError } from '../../ports/image-converter.port';
import { UnsupportedImageFormatError } from '../../services/displayable-image';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { TransactionRunner } from '../../../../shared/domain/ports/transaction-runner';
import { UploadReferencePrintCommand } from './upload-reference-print.command';
import { UploadReferencePrintHandler } from './upload-reference-print.handler';

const TIFF_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const CLEAN_PRINT_SHA256 =
  '752db2b96d9b71f1ae7650aa5b47c569e71473045fad4f54e9290035075d1e66';
const STORED_PATH =
  'media/investigation-case/case-9/reference-prints/ref-456.png';

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
      new InMemoryImageConverter(),
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

  const tiffBuffer = Buffer.concat([TIFF_MAGIC, Buffer.from('clean-print')]);

  const command = () =>
    new UploadReferencePrintCommand(EXPERT_ACTOR, tiffBuffer, 'case-9');

  it('converts a TIFF to PNG for display, archives the original under <id>_original.tif and persists the PNG path', async () => {
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
        .getSaved('investigation-case/case-9/reference-prints/ref-456.png')
        ?.equals(Buffer.concat([Buffer.from('png:'), tiffBuffer])),
    ).toBe(true);
    expect(
      storage
        .getSaved(
          'investigation-case/case-9/reference-prints/ref-456_original.tif',
        )
        ?.equals(tiffBuffer),
    ).toBe(true);
  });

  it('stores a non-TIFF upload as-is, without archive, even with a misleading name', async () => {
    const pngBuffer = Buffer.concat([PNG_MAGIC, Buffer.from('clean-print')]);
    const result = await handler.execute(
      new UploadReferencePrintCommand(EXPERT_ACTOR, pngBuffer, 'case-9'),
    );

    expect(result.path).toBe(
      'media/investigation-case/case-9/reference-prints/ref-456.png',
    );
    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.png')
        ?.equals(pngBuffer),
    ).toBe(true);
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
      ),
    ).toBeUndefined();
  });

  it('rejects an unreadable TIFF without storing or persisting anything', async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          EXPERT_ACTOR,
          Buffer.concat([TIFF_MAGIC, Buffer.from('invalid-image')]),
          'case-9',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidImageError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
      ),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
    expect(auditTrail.events).toHaveLength(0);
  });

  it('rejects a payload that is neither PNG, JPEG nor TIFF without storing anything', async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          EXPERT_ACTOR,
          Buffer.from('not-an-image'),
          'case-9',
        ),
      ),
    ).rejects.toBeInstanceOf(UnsupportedImageFormatError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
    expect(auditTrail.events).toHaveLength(0);
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
      sizeBytes: 15,
      mimeType: 'image/tiff',
    });
  });

  it('writes the reference print and its link inside a single transaction', async () => {
    await handler.execute(command());

    expect(transactionRunner.runCount).toBe(1);
  });

  it('deletes the stored PNG and the archived original, then rethrows when the transaction fails', async () => {
    const failure = new Error('rollback');

    await expect(
      buildHandler(new RollingBackTransactionRunner(failure)).execute(
        command(),
      ),
    ).rejects.toBe(failure);

    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
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
