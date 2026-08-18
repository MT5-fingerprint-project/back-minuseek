import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { TraceStatusEnum } from '../../../domain/trace/value-objects/trace-status.vo';
import { CaseUnavailableForTraceError } from '../../../domain/trace/errors/case-unavailable-for-trace.error';
import { InvalidCaptureMetadataError } from '../../../domain/trace/errors/invalid-capture-metadata.error';
import { CaptureMetadataProps } from '../../../domain/trace/value-objects/capture-metadata.vo';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { UploadTraceCommand } from './upload-trace.command';
import { UploadTraceHandler } from './upload-trace.handler';

describe('UploadTraceHandler', () => {
  let handler: UploadTraceHandler;
  let repo: InMemoryTraceRepository;
  let storage: InMemoryImageStorageAdapter;
  let caseStatus: InMemoryCaseStatusAdapter;
  let idGenerator: IdGenerator;

  beforeEach(() => {
    repo = new InMemoryTraceRepository();
    storage = new InMemoryImageStorageAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    idGenerator = { generate: jest.fn().mockReturnValue('trace-123') };
    handler = new UploadTraceHandler(repo, storage, idGenerator, caseStatus);
  });

  const command = (caseId = 'case-9', capture?: CaptureMetadataProps) =>
    new UploadTraceCommand(
      EXPERT_ACTOR,
      Buffer.from('test-image'),
      'fingerprint.png',
      'image/png',
      caseId,
      capture,
    );

  it('stores the file under media/{caseId}/traces, persists the trace as RECEIVED and returns id, path and url', async () => {
    caseStatus.set('case-9', 'OPEN');

    const result = await handler.execute(command());

    expect(result).toEqual({
      id: 'trace-123',
      path: 'media/investigation-case/case-9/traces/trace-123.png',
      url: '/media/investigation-case/case-9/traces/trace-123.png',
    });

    const saved = await repo.findById('trace-123');
    expect(saved?.path).toBe(
      'media/investigation-case/case-9/traces/trace-123.png',
    );
    expect(saved?.status).toBe(TraceStatusEnum.RECEIVED);
    expect(saved?.caseId).toBe('case-9');

    expect(
      storage
        .getSaved('investigation-case/case-9/traces/trace-123.png')
        ?.toString(),
    ).toBe('test-image');
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

  it('rejects and persists nothing when the case does not exist', async () => {
    await expect(
      handler.execute(command('missing-case')),
    ).rejects.toBeInstanceOf(CaseUnavailableForTraceError);

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/missing-case/traces/trace-123.png'),
    ).toBeUndefined();
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
    },
  );
});
