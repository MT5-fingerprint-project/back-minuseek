import { TraceStatus } from '../../../domain/trace-status';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryTraceStorageAdapter } from '../../../infrastructure/storage/in-memory-trace-storage.adapter';
import { TraceIdGenerator } from '../../ports/trace-id-generator.port';
import { UploadTraceHandler } from './upload-trace.handler';

class FixedTraceIdGenerator implements TraceIdGenerator {
  constructor(private readonly fixedId: string) {}

  nextId(): string {
    return this.fixedId;
  }
}

describe('UploadTraceHandler', () => {
  it('stores the file, persists the trace as RECEIVED, and returns its id and path', async () => {
    const repository = new InMemoryTraceRepository();
    const storage = new InMemoryTraceStorageAdapter();
    const idGenerator = new FixedTraceIdGenerator('trace-123');
    const handler = new UploadTraceHandler(repository, storage, idGenerator);

    const result = await handler.execute({
      fileBuffer: Buffer.from('test-image'),
      originalName: 'fingerprint.png',
      mimeType: 'image/png',
    });

    expect(result).toEqual({
      traceId: 'trace-123',
      path: 'media/traces/trace-123.png',
    });

    const saved = await repository.findById('trace-123');
    expect(saved?.path).toBe('media/traces/trace-123.png');
    expect(saved?.status).toBe(TraceStatus.RECEIVED);
    expect(saved?.score).toBeNull();

    const stored = storage.getSaved('trace-123.png');
    expect(stored?.toString()).toBe('test-image');
  });
});
