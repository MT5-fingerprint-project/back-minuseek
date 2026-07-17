import { Trace } from '../../../domain/trace/entity/trace';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryMatchingRepository } from '../../../infrastructure/persistence/in-memory-matching.repository';
import { InMemoryFingerprintMatcherAdapter } from '../../../infrastructure/matching/in-memory-fingerprint-matcher.adapter';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { CompareTraceCommand } from './compare-trace.command';
import { CompareTraceHandler } from './compare-trace.handler';

describe('CompareTraceHandler', () => {
  let traceRepo: InMemoryTraceRepository;
  let referencePrintRepo: InMemoryReferencePrintRepository;
  let matchingRepo: InMemoryMatchingRepository;
  let matcher: InMemoryFingerprintMatcherAdapter;
  let idGenerator: IdGenerator;
  let handler: CompareTraceHandler;

  beforeEach(() => {
    traceRepo = new InMemoryTraceRepository();
    referencePrintRepo = new InMemoryReferencePrintRepository();
    matchingRepo = new InMemoryMatchingRepository();
    matcher = new InMemoryFingerprintMatcherAdapter();
    let counter = 0;
    idGenerator = { generate: jest.fn(() => `matching-${++counter}`) };
    handler = new CompareTraceHandler(
      traceRepo,
      referencePrintRepo,
      matcher,
      matchingRepo,
      idGenerator,
    );
  });

  it('compares a trace against reference prints of the same case and persists the scores', async () => {
    await traceRepo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'case-1',
      }),
    );
    await referencePrintRepo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'case-1',
      }),
    );
    matcher.setResults([{ referencePrintId: 'ref-1', score: 87 }]);

    const result = await handler.execute(
      new CompareTraceCommand('case-1', 'trace-1', ['ref-1']),
    );

    expect(result).toEqual([
      {
        id: 'matching-1',
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
        score: 87,
        match: true,
      },
    ]);
    expect(matcher.lastInput).toEqual({
      caseId: 'case-1',
      traceId: 'trace-1',
      referencePrintIds: ['ref-1'],
    });
    const persisted = await matchingRepo.findByTraceId('trace-1');
    expect(persisted).toHaveLength(1);
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
      handler.execute(new CompareTraceCommand('case-1', 'trace-1', [])),
    ).rejects.toThrow(TraceNotFoundError);
  });

  it('rejects when a reference print belongs to another case (IDOR)', async () => {
    await traceRepo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'case-1',
      }),
    );
    await referencePrintRepo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'other-case',
      }),
    );

    await expect(
      handler.execute(new CompareTraceCommand('case-1', 'trace-1', ['ref-1'])),
    ).rejects.toThrow(ReferencePrintNotFoundError);
  });

  it('ignores matcher results for reference prints that were not requested', async () => {
    await traceRepo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'case-1',
      }),
    );
    await referencePrintRepo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'case-1',
      }),
    );
    matcher.setResults([
      { referencePrintId: 'ref-1', score: 87 },
      { referencePrintId: 'unrequested-ref', score: 99 },
    ]);

    const result = await handler.execute(
      new CompareTraceCommand('case-1', 'trace-1', ['ref-1']),
    );

    expect(result).toHaveLength(1);
    expect(result[0].referencePrintId).toBe('ref-1');
  });
});
