import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { ReferencePrintImageDestroyedError } from '../../../domain/reference-print/errors/reference-print-image-destroyed.error';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { Trace } from '../../../domain/trace/entity/trace';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { Layer } from '../../../domain/layer/entity/layer';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InsufficientMinutiaeError } from '../../../domain/hit/errors/insufficient-minutiae.error';
import { REQUIRED_MINUTIAE } from '../../../domain/hit/hit-rules';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { InMemoryHitRepository } from '../../../infrastructure/persistence/in-memory-hit.repository';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { RecordHitCommand } from './record-hit.command';
import { InMemoryMatchingRepository } from '../../../infrastructure/persistence/in-memory-matching.repository';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { Hit } from '../../../domain/hit/entity/hit';
import { Matching } from '../../../domain/matching/entity/matching';
import { RecordHitHandler } from './record-hit.handler';

describe('RecordHitHandler', () => {
  let traceRepo: InMemoryTraceRepository;
  let referencePrintRepo: InMemoryReferencePrintRepository;
  let layerRepo: InMemoryLayerRepository;
  let hitRepo: InMemoryHitRepository;
  let idGenerator: IdGenerator;
  let matchingRepo: InMemoryMatchingRepository;
  let auditTrail: InMemoryAuditTrailAppender;
  let handler: RecordHitHandler;
  let caseStatus: InMemoryCaseStatusAdapter;

  const seedMinutiae = (
    fingerprintId: string,
    count: number,
    settingsType: 'circle' | 'circleArrow' | 'minutia' = 'circle',
  ): void => {
    for (let i = 0; i < count; i++) {
      layerRepo.seed(
        Layer.create({
          id: `${fingerprintId}-min-${i}`,
          fingerprintId,
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: i,
          settings: {
            type: settingsType,
            x: i,
            y: i,
            radius: 5,
            color: '#fff',
          },
          createdByUserId: 'user-marie',
        }),
      );
    }
  };

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    traceRepo = new InMemoryTraceRepository();
    referencePrintRepo = new InMemoryReferencePrintRepository();
    layerRepo = new InMemoryLayerRepository();
    hitRepo = new InMemoryHitRepository(auditTrail);
    idGenerator = { generate: jest.fn(() => 'hit-1') };
    matchingRepo = new InMemoryMatchingRepository();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = new RecordHitHandler(
      caseStatus,
      traceRepo,
      referencePrintRepo,
      layerRepo,
      hitRepo,
      matchingRepo,
      idGenerator,
    );
  });

  const seedTraceAndReference = (): void => {
    traceRepo.seed(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
    referencePrintRepo.seed(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
  };

  it('records a hit when both sides have at least 12 minutiae', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');

    await handler.execute(
      new RecordHitCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        'ref-1',
        'user-1',
      ),
    );

    const persisted = await hitRepo.findByTraceId('trace-1');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].referencePrintId).toBe('ref-1');
    expect(persisted[0].toPrimitives().declaredByUserId).toBe('user-1');
  });

  it('counts the minutia annotation family towards the 12 required', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'minutia');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'minutia');

    await handler.execute(
      new RecordHitCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        'ref-1',
        'user-1',
      ),
    );

    const persisted = await hitRepo.findByTraceId('trace-1');
    expect(persisted).toHaveLength(1);
  });

  it('rejects when the trace has fewer than 12 minutiae', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE - 1);
    seedMinutiae('ref-1', REQUIRED_MINUTIAE);

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toThrow(InsufficientMinutiaeError);
    expect(await hitRepo.findByTraceId('trace-1')).toHaveLength(0);
  });

  it('rejects when the reference print has fewer than 12 minutiae', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE);
    seedMinutiae('ref-1', REQUIRED_MINUTIAE - 1);

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toMatchObject({ side: 'reference-print' });
    expect(await hitRepo.findByTraceId('trace-1')).toHaveLength(0);
  });

  it('does not count pencil strokes or filters as minutiae', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE);
    // 12 non-minutia annotations on the reference side → still insufficient
    for (let i = 0; i < REQUIRED_MINUTIAE; i++) {
      layerRepo.seed(
        Layer.create({
          id: `ref-1-stroke-${i}`,
          fingerprintId: 'ref-1',
          name: 'Tracé',
          type: 'ANNOTATION',
          zIndex: i,
          settings: { type: 'pencil', points: [0, 0, 1, 1] },
          createdByUserId: 'user-marie',
        }),
      );
    }

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toBeInstanceOf(InsufficientMinutiaeError);
  });

  it('rejects when the trace belongs to another case (IDOR)', async () => {
    traceRepo.seed(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'other-case',
        sha256: ANY_SEAL,
      }),
    );

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toThrow(TraceNotFoundError);
  });

  it('rejects when the reference print belongs to another case (IDOR)', async () => {
    traceRepo.seed(
      Trace.upload({
        id: 'trace-1',
        path: 'media/trace-1.png',
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
    referencePrintRepo.seed(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/ref-1.png',
        caseId: 'other-case',
        sha256: ANY_SEAL,
      }),
    );

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toThrow(ReferencePrintNotFoundError);
  });

  it('chaîne la déclaration avec les minuties et le score du couple', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE + 1, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');
    matchingRepo.seed(
      Matching.create({
        id: 'matching-1',
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
        score: 88.5,
      }),
    );

    await handler.execute(
      new RecordHitCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        'ref-1',
        'user-1',
      ),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.HIT_RECORDED);
    expect(event.caseId).toBe('case-1');
    expect(event.payload).toEqual({
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      score: 88.5,
      traceMinutiae: REQUIRED_MINUTIAE + 1,
      referenceMinutiae: REQUIRED_MINUTIAE,
      requiredMinutiae: REQUIRED_MINUTIAE,
    });
  });

  it("chaîne un score nul quand aucune comparaison n'a précédé la déclaration", async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');

    await handler.execute(
      new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
    );

    expect(auditTrail.events[0].payload).toMatchObject({ score: null });
  });

  it("n'écrit aucun maillon quand la règle de concordance rejette la déclaration", async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE - 1, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1'),
      ),
    ).rejects.toThrow(InsufficientMinutiaeError);
    expect(auditTrail.events).toHaveLength(0);
  });
  it('refuses a withdrawn trace as if it did not exist', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');
    const trace = Trace.upload({
      id: 'trace-1',
      path: 'media/trace-1.png',
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });
    trace.withdraw('DUPLICATE', new Date());
    traceRepo.seed(trace);

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1', null),
      ),
    ).rejects.toThrow(TraceNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses a withdrawn reference print as if it did not exist', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');
    const referencePrint = ReferencePrint.create({
      id: 'ref-1',
      path: 'media/ref-1.png',
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });
    referencePrint.withdraw('MISFILED', new Date());
    referencePrintRepo.seed(referencePrint);

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1', null),
      ),
    ).rejects.toThrow(ReferencePrintNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('clears the marker when a withdrawn identification is declared again', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');
    hitRepo.seed(
      Hit.fromPrimitives({
        id: 'hit-1',
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
        declaredByUserId: 'user-1',
      }),
    );
    await hitRepo.withdrawByPair('trace-1', 'ref-1', new Date(), {
      eventType: AuditEventTypeEnum.HIT_REMOVED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: EXPERT_ACTOR,
      caseId: 'case-1',
      payload: {},
    });

    await handler.execute(
      new RecordHitCommand(
        EXPERT_ACTOR,
        'case-1',
        'trace-1',
        'ref-1',
        'user-1',
      ),
    );

    expect(await hitRepo.findByTraceId('trace-1')).toHaveLength(1);
  });
  it('refuse de déclarer une identification sur une affaire close, sans rien inscrire', async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');
    caseStatus.set('case-1', 'CLOSED');

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1', null),
      ),
    ).rejects.toBeInstanceOf(CaseNotOpenForWorkError);
    expect(auditTrail.events).toHaveLength(0);
  });
  it("refuse une empreinte dont l'image a été détruite, sans rien inscrire", async () => {
    seedTraceAndReference();
    seedMinutiae('trace-1', REQUIRED_MINUTIAE, 'circle');
    seedMinutiae('ref-1', REQUIRED_MINUTIAE, 'circleArrow');
    const referencePrint = ReferencePrint.create({
      id: 'ref-1',
      path: 'media/ref-1.png',
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });
    referencePrint.markImageDestroyed(new Date());
    referencePrintRepo.seed(referencePrint);

    await expect(
      handler.execute(
        new RecordHitCommand(EXPERT_ACTOR, 'case-1', 'trace-1', 'ref-1', null),
      ),
    ).rejects.toBeInstanceOf(ReferencePrintImageDestroyedError);
    expect(auditTrail.events).toHaveLength(0);
  });
});
