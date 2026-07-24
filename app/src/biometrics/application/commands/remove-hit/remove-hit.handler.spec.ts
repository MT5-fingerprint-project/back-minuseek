import { Trace } from '../../../domain/trace/entity/trace';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { Hit } from '../../../domain/hit/entity/hit';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryHitRepository } from '../../../infrastructure/persistence/in-memory-hit.repository';
import { RemoveHitCommand } from './remove-hit.command';
import { RemoveHitHandler } from './remove-hit.handler';

describe('RemoveHitHandler', () => {
  let traceRepo: InMemoryTraceRepository;
  let referencePrintRepo: InMemoryReferencePrintRepository;
  let hitRepo: InMemoryHitRepository;
  let handler: RemoveHitHandler;

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

  beforeEach(() => {
    traceRepo = new InMemoryTraceRepository();
    referencePrintRepo = new InMemoryReferencePrintRepository();
    hitRepo = new InMemoryHitRepository();
    handler = new RemoveHitHandler(traceRepo, referencePrintRepo, hitRepo);
  });

  it('removes an existing hit', async () => {
    await seedTraceAndReference();
    await hitRepo.save(
      Hit.create({
        id: 'hit-1',
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
      }),
    );

    await handler.execute(new RemoveHitCommand('case-1', 'trace-1', 'ref-1'));

    expect(await hitRepo.findByTraceId('trace-1')).toHaveLength(0);
  });

  it('is a no-op when no hit exists for the pair', async () => {
    await seedTraceAndReference();

    await expect(
      handler.execute(new RemoveHitCommand('case-1', 'trace-1', 'ref-1')),
    ).resolves.toBeUndefined();
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
      handler.execute(new RemoveHitCommand('case-1', 'trace-1', 'ref-1')),
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
      handler.execute(new RemoveHitCommand('case-1', 'trace-1', 'ref-1')),
    ).rejects.toThrow(ReferencePrintNotFoundError);
  });
});
