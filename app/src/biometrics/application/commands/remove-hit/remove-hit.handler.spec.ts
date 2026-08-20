import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { Trace } from '../../../domain/trace/entity/trace';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { Hit } from '../../../domain/hit/entity/hit';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryHitRepository } from '../../../infrastructure/persistence/in-memory-hit.repository';
import { RemoveHitCommand } from './remove-hit.command';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { RemoveHitHandler } from './remove-hit.handler';

describe('RemoveHitHandler', () => {
  let traceRepo: InMemoryTraceRepository;
  let referencePrintRepo: InMemoryReferencePrintRepository;
  let hitRepo: InMemoryHitRepository;
  let auditTrail: InMemoryAuditTrailAppender;
  let handler: RemoveHitHandler;

  const seedTraceAndReference = async (): Promise<void> => {
    await traceRepo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
    await referencePrintRepo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
  };

  beforeEach(() => {
    traceRepo = new InMemoryTraceRepository();
    referencePrintRepo = new InMemoryReferencePrintRepository();
    hitRepo = new InMemoryHitRepository();
    auditTrail = new InMemoryAuditTrailAppender();
    handler = new RemoveHitHandler(
      traceRepo,
      referencePrintRepo,
      hitRepo,
      new InMemoryTransactionRunner(),
      auditTrail,
    );
  });

  it('removes an existing hit', async () => {
    await seedTraceAndReference();
    await hitRepo.save(
      Hit.fromPrimitives({
        id: 'hit-1',
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
        declaredByUserId: null,
      }),
    );

    await handler.execute(
      new RemoveHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
    );

    expect(await hitRepo.findByTraceId('trace-1')).toHaveLength(0);
  });

  it('is a no-op when no hit exists for the pair', async () => {
    await seedTraceAndReference();

    await expect(
      handler.execute(
        new RemoveHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects when the trace belongs to another case (IDOR)', async () => {
    await traceRepo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'other-case',
        sha256: ANY_SEAL,
      }),
    );

    await expect(
      handler.execute(
        new RemoveHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toThrow(TraceNotFoundError);
  });

  it('rejects when the reference print belongs to another case (IDOR)', async () => {
    await traceRepo.save(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
    await referencePrintRepo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'other-case',
        sha256: ANY_SEAL,
      }),
    );

    await expect(
      handler.execute(
        new RemoveHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toThrow(ReferencePrintNotFoundError);
  });

  it('chaîne le retrait de la correspondance', async () => {
    await seedTraceAndReference();
    await hitRepo.save(
      Hit.fromPrimitives({
        id: 'hit-1',
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
        declaredByUserId: 'user-1',
      }),
    );

    await handler.execute(
      new RemoveHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.HIT_REMOVED);
    expect(event.caseId).toBe('case-1');
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.payload).toEqual({
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
    });
  });

  it("n'écrit aucun maillon quand la pièce n'appartient pas au dossier", async () => {
    await seedTraceAndReference();

    await expect(
      handler.execute(
        new RemoveHitCommand(EXPERT_ACTOR, 'autre-dossier', 'trace-1', 'ref-1'),
      ),
    ).rejects.toThrow(TraceNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });
});
