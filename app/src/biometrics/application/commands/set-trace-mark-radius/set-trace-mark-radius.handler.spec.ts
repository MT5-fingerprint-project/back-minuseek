import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InvalidMarkRadiusError } from '../../../domain/mark-radius.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { CaseUnavailableForTraceError } from '../../../domain/trace/errors/case-unavailable-for-trace.error';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { SetTraceMarkRadiusCommand } from './set-trace-mark-radius.command';
import { SetTraceMarkRadiusHandler } from './set-trace-mark-radius.handler';

const STORED_PATH = 'media/investigation-case/case-1/traces/trace-1.png';

describe('SetTraceMarkRadiusHandler', () => {
  let handler: SetTraceMarkRadiusHandler;
  let repo: InMemoryTraceRepository;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;

  const seededTrace = () =>
    Trace.upload({
      id: 'trace-1',
      number: 1,
      path: STORED_PATH,
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryTraceRepository(auditTrail);
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = new SetTraceMarkRadiusHandler(repo, caseStatus);
    repo.seed(seededTrace());
  });

  it('writes the marker size onto the trace', async () => {
    await handler.execute(
      new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 36),
    );

    const trace = await repo.findById('trace-1');
    expect(trace?.markRadius).toBe(36);
  });

  it('chains a MARK_RADIUS_SET event naming the piece and its new size', async () => {
    await handler.execute(
      new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 36),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.MARK_RADIUS_SET);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.DECLARED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      fingerprintId: 'trace-1',
      markRadius: 36,
      previousMarkRadius: null,
    });
  });

  it('carries both the previous and the new size on a correction', async () => {
    await handler.execute(
      new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 36),
    );

    await handler.execute(
      new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 48),
    );

    expect(auditTrail.events).toHaveLength(2);
    const [, second] = auditTrail.events;
    expect(second.payload).toEqual({
      fingerprintId: 'trace-1',
      markRadius: 48,
      previousMarkRadius: 36,
    });
  });

  it('rejects an unknown piece and chains nothing', async () => {
    await expect(
      handler.execute(
        new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'missing', 36),
      ),
    ).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses to retouch the markers of a closed case, chains nothing and leaves the size untouched', async () => {
    await handler.execute(
      new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 36),
    );
    caseStatus.set('case-1', 'CLOSED');

    await expect(
      handler.execute(
        new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 48),
      ),
    ).rejects.toBeInstanceOf(CaseNotOpenForWorkError);

    expect(auditTrail.events).toHaveLength(1);
    const trace = await repo.findById('trace-1');
    expect(trace?.markRadius).toBe(36);
  });

  it('refuses a piece whose case is out of reach and chains nothing', async () => {
    caseStatus.set('case-1', 'OPEN');
    repo.seed(
      Trace.upload({
        id: 'trace-2',
        number: 2,
        path: STORED_PATH,
        caseId: 'case-orphan',
        sha256: ANY_SEAL,
      }),
    );

    await expect(
      handler.execute(
        new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-2', 36),
      ),
    ).rejects.toBeInstanceOf(CaseUnavailableForTraceError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses a size outside the accepted range, chains nothing and leaves the value untouched', async () => {
    await handler.execute(
      new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 36),
    );

    await expect(
      handler.execute(
        new SetTraceMarkRadiusCommand(EXPERT_ACTOR, 'trace-1', 2001),
      ),
    ).rejects.toBeInstanceOf(InvalidMarkRadiusError);

    expect(auditTrail.events).toHaveLength(1);
    const trace = await repo.findById('trace-1');
    expect(trace?.markRadius).toBe(36);
  });
});
