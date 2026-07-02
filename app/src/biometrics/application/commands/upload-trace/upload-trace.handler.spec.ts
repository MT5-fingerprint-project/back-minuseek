import { TraceStatusEnum } from '../../../domain/trace/value-objects/trace-status.vo';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { UploadTraceCommand } from './upload-trace.command';
import { UploadTraceHandler } from './upload-trace.handler';

describe('UploadTraceHandler', () => {
  let handler: UploadTraceHandler;
  let repo: InMemoryTraceRepository;
  let storage: InMemoryImageStorageAdapter;
  let idGenerator: IdGenerator;

  beforeEach(() => {
    repo = new InMemoryTraceRepository();
    storage = new InMemoryImageStorageAdapter();
    idGenerator = { generate: jest.fn().mockReturnValue('trace-123') };
    handler = new UploadTraceHandler(repo, storage, idGenerator);
  });

  it('stores the file under media/{caseId}/traces, persists the trace as RECEIVED and returns id, path and url', async () => {
    const result = await handler.execute(
      new UploadTraceCommand(
        Buffer.from('test-image'),
        'fingerprint.png',
        'image/png',
        'case-9',
      ),
    );

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
});
