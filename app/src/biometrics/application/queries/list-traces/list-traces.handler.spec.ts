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

const traceRow = (overrides: Partial<TraceReadModel> = {}): TraceReadModel => ({
  id: 'trace-1',
  path: 'media/investigation-case/case-9/traces/trace-1.png',
  status: 'RECEIVED',
  score: null,
  caseId: 'case-9',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  captureWidth: null,
  captureHeight: null,
  capturedAt: null,
  captureOrientation: null,
  captureFocalLength: null,
  captureDeviceModel: null,
  captureQuality: null,
  ...overrides,
});

describe('ListTracesHandler', () => {
  it('adds a url derived from the path to each trace of the case', async () => {
    const reader = new InMemoryTraceReader([traceRow()]);
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

  it('exposes the capture metadata of each trace', async () => {
    const reader = new InMemoryTraceReader([
      traceRow({
        captureWidth: 3024,
        captureHeight: 4032,
        capturedAt: new Date('2026-08-18T10:12:00.000Z'),
        captureOrientation: 6,
        captureFocalLength: 6.86,
        captureDeviceModel: 'iPhone 14 Pro',
      }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data[0]).toMatchObject({
      captureWidth: 3024,
      captureHeight: 4032,
      capturedAt: new Date('2026-08-18T10:12:00.000Z'),
      captureOrientation: 6,
      captureFocalLength: 6.86,
      captureDeviceModel: 'iPhone 14 Pro',
    });
  });

  it('exposes the capture quality check, so the lab can sort on it', async () => {
    const reader = new InMemoryTraceReader([
      traceRow({ captureQuality: { blurScore: 128.4, passed: true } }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data[0].captureQuality).toEqual({ blurScore: 128.4, passed: true });
  });

  it('leaves the capture metadata null for a trace uploaded without any', async () => {
    const reader = new InMemoryTraceReader([traceRow()]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data[0]).toMatchObject({
      captureWidth: null,
      captureHeight: null,
      capturedAt: null,
      captureOrientation: null,
      captureFocalLength: null,
      captureDeviceModel: null,
      captureQuality: null,
    });
  });
});
