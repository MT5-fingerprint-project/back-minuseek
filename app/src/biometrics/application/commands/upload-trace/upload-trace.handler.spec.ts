import { TraceStatusEnum } from '../../../domain/trace/value-objects/trace-status.vo';
import { CaseUnavailableForTraceError } from '../../../domain/trace/errors/case-unavailable-for-trace.error';
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

  const command = (caseId = 'case-9') =>
    new UploadTraceCommand(
      Buffer.from('test-image'),
      'fingerprint.png',
      'image/png',
      caseId,
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
