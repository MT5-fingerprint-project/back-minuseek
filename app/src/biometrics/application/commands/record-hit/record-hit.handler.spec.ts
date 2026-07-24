import { Trace } from '../../../domain/trace/entity/trace';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { Layer } from '../../../domain/layer/entity/layer';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InsufficientMinutiaeError } from '../../../domain/hit/errors/insufficient-minutiae.error';
import { REQUIRED_MINUTIAE } from '../../../domain/hit/hit-rules';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { InMemoryHitRepository } from '../../../infrastructure/persistence/in-memory-hit.repository';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { RecordHitCommand } from './record-hit.command';
import { RecordHitHandler } from './record-hit.handler';

describe('RecordHitHandler', () => {
  let traceRepo: InMemoryTraceRepository;
  let referencePrintRepo: InMemoryReferencePrintRepository;
  let layerRepo: InMemoryLayerRepository;
  let hitRepo: InMemoryHitRepository;
  let idGenerator: IdGenerator;
  let handler: RecordHitHandler;

  const seedMinutiae = async (
    fingerprintId: string,
    count: number,
    settingsType: 'circle' | 'circleArrow' = 'circle',
  ): Promise<void> => {
    for (let i = 0; i < count; i++) {
      await layerRepo.save(
        Layer.create({
          id: `${fingerprintId}-min-${i}`,
          fingerprintId,
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: i,
          settings: { type: settingsType, x: i, y: i, radius: 5, color: '#fff' },
        }),
      );
    }
  };

  beforeEach(() => {
    traceRepo = new InMemoryTraceRepository();
    referencePrintRepo = new InMemoryReferencePrintRepository();
    layerRepo = new InMemoryLayerRepository();
    hitRepo = new InMemoryHitRepository();
    idGenerator = { generate: jest.fn(() => 'hit-1') };
    handler = new RecordHitHandler(
      traceRepo,
      referencePrintRepo,
      layerRepo,
      hitRepo,
      idGenerator,
    );
  });

  const seedTraceAndReference = async (): Promise<void> => {
    await traceRepo.save(
      Trace.upload({ id: 'trace-1', path: 'media/trace-1.png', caseId: 'case-1' }),
    );
    await referencePrintRepo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'case-1',
      }),
    );
  };

  it('records a hit when both sides have at least 12 minutiae', async () => {
    await seedTraceAndReference();
    await seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    await seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');

    await handler.execute(
      new RecordHitCommand('case-1', 'trace-1', 'ref-1', 'user-1'),
    );

    const persisted = await hitRepo.findByTraceId('trace-1');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].referencePrintId).toBe('ref-1');
    expect(persisted[0].toPrimitives().declaredByUserId).toBe('user-1');
  });

  it('rejects when the trace has fewer than 12 minutiae', async () => {
    await seedTraceAndReference();
    await seedMinutiae('trace-1', REQUIRED_MINUTIAE - 1);
    await seedMinutiae('ref-1', REQUIRED_MINUTIAE);

    await expect(
      handler.execute(new RecordHitCommand('case-1', 'trace-1', 'ref-1')),
    ).rejects.toThrow(InsufficientMinutiaeError);
    expect(await hitRepo.findByTraceId('trace-1')).toHaveLength(0);
  });

  it('rejects when the reference print has fewer than 12 minutiae', async () => {
    await seedTraceAndReference();
    await seedMinutiae('trace-1', REQUIRED_MINUTIAE);
    await seedMinutiae('ref-1', REQUIRED_MINUTIAE - 1);

    await expect(
      handler.execute(new RecordHitCommand('case-1', 'trace-1', 'ref-1')),
    ).rejects.toMatchObject({ side: 'reference-print' });
    expect(await hitRepo.findByTraceId('trace-1')).toHaveLength(0);
  });

  it('does not count pencil strokes or filters as minutiae', async () => {
    await seedTraceAndReference();
    await seedMinutiae('trace-1', REQUIRED_MINUTIAE);
    // 12 non-minutia annotations on the reference side → still insufficient
    for (let i = 0; i < REQUIRED_MINUTIAE; i++) {
      await layerRepo.save(
        Layer.create({
          id: `ref-1-stroke-${i}`,
          fingerprintId: 'ref-1',
          name: 'Tracé',
          type: 'ANNOTATION',
          zIndex: i,
          settings: { type: 'pencil', points: [0, 0, 1, 1] },
        }),
      );
    }

    await expect(
      handler.execute(new RecordHitCommand('case-1', 'trace-1', 'ref-1')),
    ).rejects.toBeInstanceOf(InsufficientMinutiaeError);
  });

  it('rejects when the trace belongs to another case (IDOR)', async () => {
    await traceRepo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'other-case',
      }),
    );

    await expect(
      handler.execute(new RecordHitCommand('case-1', 'trace-1', 'ref-1')),
    ).rejects.toThrow(TraceNotFoundError);
  });

  it('rejects when the reference print belongs to another case (IDOR)', async () => {
    await traceRepo.save(
      Trace.upload({ id: 'trace-1', path: 'media/trace-1.png', caseId: 'case-1' }),
    );
    await referencePrintRepo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'other-case',
      }),
    );

    await expect(
      handler.execute(new RecordHitCommand('case-1', 'trace-1', 'ref-1')),
    ).rejects.toThrow(ReferencePrintNotFoundError);
  });
});
