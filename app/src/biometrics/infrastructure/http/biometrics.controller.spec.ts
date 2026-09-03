import { NotFoundException } from '@nestjs/common';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetTraceQuery } from '../../application/queries/get-trace/get-trace.query';
import type { TraceDetailView } from '../../application/queries/list-traces/trace-read-model';
import { BiometricsController } from './biometrics.controller';

const TRACE = '22222222-2222-4222-8222-222222222222';

const aTraceView = (
  overrides: Partial<TraceDetailView> = {},
): TraceDetailView => ({
  id: TRACE,
  number: 7,
  reference: '3455-T7',
  path: 'media/investigation-case/case-9/traces/trace-1.png',
  url: 'https://storage.example/trace-1.png?signature=abc',
  thumbUrl: 'https://storage.example/trace-1_thumb.webp?signature=abc',
  status: 'RECEIVED',
  cote: null,
  caseId: 'case-9',
  identified: false,
  notIdentified: false,
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
  withdrawalMotiveDetail: null,
  resolutionDpi: null,
  origin: null,
  location: null,
  revelationTechnique: null,
  hasLocationPhoto: false,
  thumbPath: null,
  locationPhoto: null,
  ...overrides,
});

function build(answer: TraceDetailView | null) {
  const dispatched: GetTraceQuery[] = [];
  const queryBus = {
    execute: (query: GetTraceQuery) => {
      dispatched.push(query);
      return Promise.resolve(answer);
    },
  } as unknown as QueryBus;
  const commandBus = {
    execute: () => Promise.resolve(),
  } as unknown as CommandBus;

  return {
    controller: new BiometricsController(commandBus, queryBus),
    dispatched,
  };
}

describe('BiometricsController — la fiche d’une trace seule', () => {
  it('rend la trace telle que la lecture la compose', async () => {
    const { controller } = build(aTraceView());

    await expect(controller.getTrace(TRACE, null)).resolves.toMatchObject({
      reference: '3455-T7',
      url: 'https://storage.example/trace-1.png?signature=abc',
      thumbUrl: 'https://storage.example/trace-1_thumb.webp?signature=abc',
    });
  });

  it('répond « introuvable » quand la lecture ne rend rien', async () => {
    const { controller } = build(null);

    await expect(controller.getTrace(TRACE, null)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('transmet la mission de vérification en aveugle à la lecture', async () => {
    const { controller, dispatched } = build(aTraceView());

    await controller.getTrace(TRACE, 'user-lucie');

    expect(dispatched[0]).toEqual(new GetTraceQuery(TRACE, 'user-lucie'));
  });
});
