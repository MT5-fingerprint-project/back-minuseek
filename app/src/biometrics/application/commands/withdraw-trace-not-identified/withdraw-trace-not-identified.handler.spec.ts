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
import { WithdrawTraceNotIdentifiedCommand } from './withdraw-trace-not-identified.command';
import { WithdrawTraceNotIdentifiedHandler } from './withdraw-trace-not-identified.handler';

const STORED_PATH = 'media/investigation-case/case-1/traces/trace-1.png';

describe('WithdrawTraceNotIdentifiedHandler', () => {
  let handler: WithdrawTraceNotIdentifiedHandler;
  let repo: InMemoryTraceRepository;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;

  const withdraw = (id = 'trace-1') =>
    new WithdrawTraceNotIdentifiedCommand(EXPERT_ACTOR, id);

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryTraceRepository(auditTrail);
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = new WithdrawTraceNotIdentifiedHandler(repo, caseStatus);
    const trace = Trace.upload({
      id: 'trace-1',
      number: 1,
      path: STORED_PATH,
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });
    trace.declareNotIdentified(new Date('2026-08-20T09:00:00.000Z'));
    repo.seed(trace);
  });

  it('efface la date de déclaration', async () => {
    await handler.execute(withdraw());

    expect((await repo.findById('trace-1'))?.notIdentifiedAt).toBeNull();
  });

  it('chaîne un TRACE_NOT_IDENTIFIED portant le retrait et son auteur', async () => {
    await handler.execute(withdraw());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_NOT_IDENTIFIED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.DECLARED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({ notIdentified: false });
  });

  it('accepte un retrait alors que rien n’était déclaré, et chaîne l’acte', async () => {
    const bareTrace = Trace.upload({
      id: 'trace-2',
      number: 2,
      path: STORED_PATH,
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });
    repo.seed(bareTrace);

    await expect(handler.execute(withdraw('trace-2'))).resolves.not.toThrow();

    expect((await repo.findById('trace-2'))?.notIdentifiedAt).toBeNull();
    expect(auditTrail.events).toHaveLength(1);
  });

  it('refuse une trace inconnue et ne chaîne rien', async () => {
    await expect(handler.execute(withdraw('missing'))).rejects.toBeInstanceOf(
      TraceNotFoundError,
    );

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse de retirer sur un dossier clos et ne chaîne rien', async () => {
    caseStatus.set('case-1', 'CLOSED');

    await expect(handler.execute(withdraw())).rejects.toBeInstanceOf(
      CaseNotOpenForWorkError,
    );

    expect(auditTrail.events).toHaveLength(0);
    expect((await repo.findById('trace-1'))?.notIdentifiedAt).not.toBeNull();
  });
});
