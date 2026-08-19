import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { TraceStatusEnum } from '../../../domain/trace/value-objects/trace-status.vo';
import { CaseUnavailableForTraceError } from '../../../domain/trace/errors/case-unavailable-for-trace.error';
import { InvalidCaptureMetadataError } from '../../../domain/trace/errors/invalid-capture-metadata.error';
import { CaptureMetadataProps } from '../../../domain/trace/value-objects/capture-metadata.vo';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryImageConverter } from '../../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { TransactionRunner } from '../../../../shared/domain/ports/transaction-runner';
import { UploadTraceCommand } from './upload-trace.command';
import { UploadTraceHandler } from './upload-trace.handler';

const TEST_IMAGE_SHA256 =
  'cd9de65ea00593ca8023392a7b15e60b322c9a10fd57293ccb428cc7c4d1ce76';
const STORED_PATH = 'media/investigation-case/case-9/traces/trace-123.png';

class RollingBackTransactionRunner implements TransactionRunner {
  constructor(private readonly failure: Error) {}

  run<T>(): Promise<T> {
    return Promise.reject(this.failure);
  }
}

describe('UploadTraceHandler', () => {
  let handler: UploadTraceHandler;
  let repo: InMemoryTraceRepository;
  let storage: InMemoryImageStorageAdapter;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let transactionRunner: InMemoryTransactionRunner;
  let idGenerator: IdGenerator;

  const buildHandler = (runner: TransactionRunner) =>
    new UploadTraceHandler(
      repo,
      storage,
      idGenerator,
      caseStatus,
      new InMemoryImageConverter(),
      runner,
      auditTrail,
    );

  beforeEach(() => {
    repo = new InMemoryTraceRepository();
    storage = new InMemoryImageStorageAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    auditTrail = new InMemoryAuditTrailAppender();
    transactionRunner = new InMemoryTransactionRunner();
    idGenerator = { generate: jest.fn().mockReturnValue('trace-123') };
    handler = buildHandler(transactionRunner);
  });

  const pngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    Buffer.from('test-image'),
  ]);

  const command = (caseId = 'case-9', capture?: CaptureMetadataProps) =>
    new UploadTraceCommand(EXPERT_ACTOR, pngBuffer, caseId, capture);

  it('stores the file under media/{caseId}/traces, persists the trace as RECEIVED and returns id, path and url', async () => {
    caseStatus.set('case-9', 'OPEN');

    const result = await handler.execute(command());

    expect(result).toEqual({
      id: 'trace-123',
      path: STORED_PATH,
      url: `/${STORED_PATH}`,
    });

    const saved = await repo.findById('trace-123');
    expect(saved?.path).toBe(STORED_PATH);
    expect(saved?.status).toBe(TraceStatusEnum.RECEIVED);
    expect(saved?.caseId).toBe('case-9');

    expect(
      storage
        .getSaved('investigation-case/case-9/traces/trace-123.png')
        ?.equals(pngBuffer),
    ).toBe(true);
  });

  it('persists the capture metadata carried by the upload', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(
      command('case-9', {
        width: 3024,
        height: 4032,
        capturedAt: '2026-08-18T10:12:00.000Z',
        orientation: 6,
        focalLength: 6.86,
        deviceModel: 'iPhone 14 Pro',
      }),
    );

    const saved = await repo.findById('trace-123');
    expect(saved?.toPrimitives()).toMatchObject({
      captureWidth: 3024,
      captureHeight: 4032,
      capturedAt: new Date('2026-08-18T10:12:00.000Z'),
      captureOrientation: 6,
      captureFocalLength: 6.86,
      captureDeviceModel: 'iPhone 14 Pro',
    });
  });

  it('persists no capture metadata when the upload carries none', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    const saved = await repo.findById('trace-123');
    expect(saved?.toPrimitives()).toMatchObject({
      captureWidth: null,
      captureHeight: null,
      capturedAt: null,
      captureOrientation: null,
      captureFocalLength: null,
      captureDeviceModel: null,
    });
  });

  it('rejects invalid capture metadata without storing the file nor persisting the trace', async () => {
    caseStatus.set('case-9', 'OPEN');

    await expect(
      handler.execute(command('case-9', { orientation: 42 })),
    ).rejects.toBeInstanceOf(InvalidCaptureMetadataError);

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
    ).toBeUndefined();
  });

  it('accepts an upload when the case is IN_PROGRESS', async () => {
    caseStatus.set('case-9', 'IN_PROGRESS');

    const result = await handler.execute(command());

    expect(result.id).toBe('trace-123');
    expect(await repo.findById('trace-123')).not.toBeNull();
  });

  it('seals the deposited bytes on the trace', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    expect((await repo.findById('trace-123'))?.sha256).toBe(TEST_IMAGE_SHA256);
  });

  it('chains a TRACE_UPLOADED event carrying the seal of the deposit', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_UPLOADED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBe('trace-123');
    expect(event.payload).toEqual({
      fileSha256: TEST_IMAGE_SHA256,
      storagePath: STORED_PATH,
      sizeBytes: 14,
      mimeType: 'image/png',
    });
  });

  it('writes the trace and its link inside a single transaction', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    expect(transactionRunner.runCount).toBe(1);
  });

  it('deletes the stored file and rethrows when the transaction fails', async () => {
    caseStatus.set('case-9', 'OPEN');
    const failure = new Error('rollback');

    await expect(
      buildHandler(new RollingBackTransactionRunner(failure)).execute(
        command(),
      ),
    ).rejects.toBe(failure);

    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
    ).toBeUndefined();
  });

  it('keeps the upload when the compensating delete itself fails', async () => {
    caseStatus.set('case-9', 'OPEN');
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

  it('rejects and persists nothing when the case does not exist', async () => {
    await expect(
      handler.execute(command('missing-case')),
    ).rejects.toBeInstanceOf(CaseUnavailableForTraceError);

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/missing-case/traces/trace-123.png'),
    ).toBeUndefined();
    expect(auditTrail.events).toHaveLength(0);
  });

  it.each(['CLOSED', 'UNDER_REVIEW'])(
    'rejects and persists nothing when the case status is %s',
    async (status) => {
      caseStatus.set('case-9', status);

      await expect(handler.execute(command())).rejects.toBeInstanceOf(
        CaseUnavailableForTraceError,
      );

      expect(await repo.findById('trace-123')).toBeNull();
      expect(
        storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
      ).toBeUndefined();
      expect(auditTrail.events).toHaveLength(0);
    },
  );
});
