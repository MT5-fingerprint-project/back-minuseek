import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { DeleteTraceCommand } from './delete-trace.command';
import { DeleteTraceHandler } from './delete-trace.handler';

describe('DeleteTraceHandler', () => {
  let handler: DeleteTraceHandler;
  let repo: InMemoryTraceRepository;
  let storage: InMemoryImageStorageAdapter;

  beforeEach(() => {
    repo = new InMemoryTraceRepository();
    storage = new InMemoryImageStorageAdapter();
    handler = new DeleteTraceHandler(repo, storage);
  });

  it('deletes the trace, its PNG and the archived TIFF original', async () => {
    await storage.save(
      Buffer.from('png'),
      'investigation-case/case-1/traces/trace-1.png',
    );
    await storage.save(
      Buffer.from('tif'),
      'investigation-case/case-1/traces/trace-1_original.tif',
    );
    await repo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/investigation-case/case-1/traces/trace-1.png',
        caseId: 'case-1',
      }),
    );

    await handler.execute(new DeleteTraceCommand('trace-1'));

    expect(await repo.findById('trace-1')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-1/traces/trace-1.png'),
    ).toBeUndefined();
    expect(
      storage.getSaved('investigation-case/case-1/traces/trace-1_original.tif'),
    ).toBeUndefined();
  });

  it('deletes a non-TIFF upload without failing on the missing archive', async () => {
    await storage.save(
      Buffer.from('jpg'),
      'investigation-case/case-1/traces/trace-1.jpg',
    );
    await repo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/investigation-case/case-1/traces/trace-1.jpg',
        caseId: 'case-1',
      }),
    );

    await handler.execute(new DeleteTraceCommand('trace-1'));

    expect(await repo.findById('trace-1')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-1/traces/trace-1.jpg'),
    ).toBeUndefined();
  });

  it('rejects when the trace does not exist', async () => {
    await expect(
      handler.execute(new DeleteTraceCommand('missing')),
    ).rejects.toBeInstanceOf(TraceNotFoundError);
  });
});
