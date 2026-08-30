import { InMemoryTraceReader } from '../../../infrastructure/persistence/in-memory-trace.reader';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { TraceReadModel } from '../list-traces/trace-read-model';
import { TraceReader } from '../list-traces/trace.reader';
import { GetTraceHandler } from './get-trace.handler';
import { GetTraceQuery } from './get-trace.query';

const traceRow = (overrides: Partial<TraceReadModel> = {}): TraceReadModel => ({
  id: 'trace-1',
  number: 7,
  reference: '3455-T7',
  path: 'media/investigation-case/case-9/traces/trace-1.png',
  status: 'RECEIVED',
  score: null,
  caseId: 'case-9',
  identified: false,
  sha256: 'a'.repeat(64),
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  updatedAt: new Date('2026-07-02T00:00:00.000Z'),
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
  origin: null,
  location: null,
  revelationTechnique: null,
  ...overrides,
});

const handlerOver = (reader: TraceReader) =>
  new GetTraceHandler(reader, new InMemoryImageStorageAdapter());

describe('GetTraceHandler', () => {
  it('rend la trace avec sa référence et son adresse signée', async () => {
    const handler = handlerOver(new InMemoryTraceReader([traceRow()]));

    const trace = await handler.execute(new GetTraceQuery('trace-1'));

    expect(trace).toMatchObject({
      id: 'trace-1',
      number: 7,
      reference: '3455-T7',
      caseId: 'case-9',
      status: 'RECEIVED',
      identified: false,
      sha256: 'a'.repeat(64),
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-02T00:00:00.000Z'),
      url: '/media/investigation-case/case-9/traces/trace-1.png',
    });
  });

  it("ne rend rien quand la trace n'existe pas", async () => {
    const handler = handlerOver(new InMemoryTraceReader([traceRow()]));

    await expect(
      handler.execute(new GetTraceQuery('trace-inconnue')),
    ).resolves.toBeNull();
  });

  it("ne rend rien quand l'affaire de la trace n'existe plus", async () => {
    const handler = handlerOver(new InMemoryTraceReader([traceRow()], []));

    await expect(
      handler.execute(new GetTraceQuery('trace-1')),
    ).resolves.toBeNull();
  });

  it("cache l'identification et l'exploitabilité au vérificateur en mission", async () => {
    const handler = handlerOver(
      new InMemoryTraceReader([
        traceRow({ identified: true, status: 'EXPLOITABLE' }),
      ]),
    );

    const trace = await handler.execute(
      new GetTraceQuery('trace-1', 'user-lucie'),
    );

    expect(trace).toMatchObject({ identified: null, status: null });
  });

  it('laisse le reste de la trace visible au vérificateur en mission', async () => {
    const handler = handlerOver(
      new InMemoryTraceReader([traceRow({ score: 42 })]),
    );

    const trace = await handler.execute(
      new GetTraceQuery('trace-1', 'user-lucie'),
    );

    expect(trace).toMatchObject({
      reference: '3455-T7',
      score: 42,
      url: '/media/investigation-case/case-9/traces/trace-1.png',
    });
  });
});
