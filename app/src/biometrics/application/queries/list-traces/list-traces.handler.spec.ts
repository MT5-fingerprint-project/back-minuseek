import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { ListTracesHandler } from './list-traces.handler';
import { ListTracesQuery } from './list-traces.query';
import { TraceReadModel } from './trace-read-model';
import { TraceReader } from './trace.reader';

class InMemoryTraceReader implements TraceReader {
  constructor(private readonly traces: TraceReadModel[]) {}

  findByCaseId(caseId: string): Promise<TraceReadModel[]> {
    return Promise.resolve(
      this.traces.filter((trace) => trace.caseId === caseId),
    );
  }
}

describe('ListTracesHandler', () => {
  it('adds a url derived from the path to each trace of the case', async () => {
    const reader = new InMemoryTraceReader([
      {
        id: 'trace-1',
        path: 'media/investigation-case/case-9/traces/trace-1.png',
        status: 'RECEIVED',
        score: null,
        caseId: 'case-9',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data).toHaveLength(1);
    expect(data[0].path).toBe(
      'media/investigation-case/case-9/traces/trace-1.png',
    );
    expect(data[0].url).toBe(
      '/media/investigation-case/case-9/traces/trace-1.png',
    );
  });
});
