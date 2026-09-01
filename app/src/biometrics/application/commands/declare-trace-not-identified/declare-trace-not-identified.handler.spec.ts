import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { DeclareTraceNotIdentifiedCommand } from './declare-trace-not-identified.command';
import { DeclareTraceNotIdentifiedHandler } from './declare-trace-not-identified.handler';

const STORED_PATH = 'media/investigation-case/case-1/traces/trace-1.png';

describe('DeclareTraceNotIdentifiedHandler', () => {
  let handler: DeclareTraceNotIdentifiedHandler;
  let repo: InMemoryTraceRepository;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;

  const declare = (id = 'trace-1') =>
    new DeclareTraceNotIdentifiedCommand(EXPERT_ACTOR, id);

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryTraceRepository(auditTrail);
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = new DeclareTraceNotIdentifiedHandler(repo, caseStatus);
    repo.seed(
      Trace.upload({
        id: 'trace-1',
        number: 1,
        path: STORED_PATH,
        caseId: 'case-1',
        sha256: ANY_SEAL,
      }),
    );
  });

  it('pose la date de déclaration', async () => {
    await handler.execute(declare());

    expect((await repo.findById('trace-1'))?.notIdentifiedAt).not.toBeNull();
  });

  it('chaîne un TRACE_NOT_IDENTIFIED portant la déclaration et son auteur', async () => {
    await handler.execute(declare());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_NOT_IDENTIFIED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.DECLARED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({ notIdentified: true });
  });

  it('accepte de redéclarer, et chaîne les deux actes', async () => {
    await handler.execute(declare());
    await handler.execute(declare());

    expect(auditTrail.events).toHaveLength(2);
    expect((await repo.findById('trace-1'))?.notIdentifiedAt).not.toBeNull();
  });

  it('refuse une trace inconnue et ne chaîne rien', async () => {
    await expect(handler.execute(declare('missing'))).rejects.toBeInstanceOf(
      TraceNotFoundError,
    );

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse de déclarer sur un dossier clos et ne chaîne rien', async () => {
    caseStatus.set('case-1', 'CLOSED');

    await expect(handler.execute(declare())).rejects.toBeInstanceOf(
      CaseNotOpenForWorkError,
    );

    expect(auditTrail.events).toHaveLength(0);
    expect((await repo.findById('trace-1'))?.notIdentifiedAt).toBeNull();
  });
});
