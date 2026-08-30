import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { ListTracesHandler } from './list-traces.handler';
import { ListTracesQuery } from './list-traces.query';
import { TraceReadModel } from './trace-read-model';
import { TraceReader } from './trace.reader';

class InMemoryTraceReader implements TraceReader {
  constructor(private readonly traces: TraceReadModel[]) {}

  // Même ordre que `prisma-trace.reader.ts` : la plus récente d'abord, puis
  // l'identifiant pour départager deux dépôts de la même seconde.
  findByCaseId(caseId: string, withdrawn = false): Promise<TraceReadModel[]> {
    return Promise.resolve(
      this.traces
        .filter(
          (trace) =>
            trace.caseId === caseId &&
            (trace.withdrawnAt !== null) === withdrawn,
        )
        .sort(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime() ||
            left.id.localeCompare(right.id),
        ),
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
  withdrawnAt: null,
  withdrawalMotive: null,
  resolutionDpi: null,
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

  it('exposes the calibrated resolution of a trace', async () => {
    const reader = new InMemoryTraceReader([
      traceRow({ resolutionDpi: 1207.34 }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data[0].resolutionDpi).toBe(1207.34);
  });

  it('leaves the resolution empty for an uncalibrated trace', async () => {
    const reader = new InMemoryTraceReader([traceRow()]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data[0].resolutionDpi).toBeNull();
  });

  it('départage deux traces déposées dans la même seconde par leur identifiant', async () => {
    const capturedAt = new Date('2026-07-01T00:00:00.000Z');
    const reader = new InMemoryTraceReader([
      traceRow({ id: 'trace-a', createdAt: capturedAt }),
      traceRow({ id: 'trace-c', createdAt: capturedAt }),
      traceRow({ id: 'trace-b', createdAt: capturedAt }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data.map((trace) => trace.id)).toEqual([
      'trace-a',
      'trace-b',
      'trace-c',
    ]);
  });
  it('ne liste que les traces retirées quand on les demande', async () => {
    const reader = new InMemoryTraceReader([
      traceRow(),
      traceRow({
        id: 'trace-2',
        withdrawnAt: new Date('2026-08-12T09:00:00.000Z'),
        withdrawalMotive: 'DUPLICATE',
      }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9', true));

    expect(data.map((trace) => trace.id)).toEqual(['trace-2']);
    expect(data[0].withdrawalMotive).toBe('DUPLICATE');
    expect(data[0].url).toBeDefined();
  });

  it("hides the operator's exploitability declaration from a verifier in mission", async () => {
    const reader = new InMemoryTraceReader([
      traceRow({ status: 'EXPLOITABLE' }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(
      new ListTracesQuery('case-9', false, 'user-lucie'),
    );

    expect(data[0].status).toBeNull();
  });

  it('leaves the rest of the trace visible to a verifier in mission', async () => {
    const reader = new InMemoryTraceReader([
      traceRow({ status: 'EXPLOITABLE', score: 42, captureWidth: 3024 }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(
      new ListTracesQuery('case-9', false, 'user-lucie'),
    );

    expect(data[0]).toMatchObject({
      id: 'trace-1',
      score: 42,
      captureWidth: 3024,
      url: '/media/investigation-case/case-9/traces/trace-1.png',
    });
  });

  it('keeps the declaration for the case operator', async () => {
    const reader = new InMemoryTraceReader([
      traceRow({ status: 'EXPLOITABLE' }),
    ]);
    const handler = new ListTracesHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(new ListTracesQuery('case-9'));

    expect(data[0].status).toBe('EXPLOITABLE');
  });
});
