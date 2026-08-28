import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { NotWithdrawnError } from '../../../domain/withdrawal/errors/not-withdrawn.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { RestoreTraceCommand } from './restore-trace.command';
import { RestoreTraceHandler } from './restore-trace.handler';

const WITHDRAWN_AT = new Date('2026-08-12T09:00:00.000Z');

describe('RestoreTraceHandler', () => {
  let handler: RestoreTraceHandler;
  let repo: InMemoryTraceRepository;
  let auditTrail: InMemoryAuditTrailAppender;

  const trace = (): Trace =>
    Trace.upload({
      id: 'trace-1',
      path: 'media/investigation-case/case-1/traces/trace-1.png',
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryTraceRepository(auditTrail);
    handler = new RestoreTraceHandler(repo);
  });

  it('brings a withdrawn trace back to the working case', async () => {
    const withdrawn = trace();
    withdrawn.withdraw('DUPLICATE', WITHDRAWN_AT);
    repo.seed(withdrawn);

    await handler.execute(new RestoreTraceCommand(EXPERT_ACTOR, 'trace-1'));

    expect((await repo.findById('trace-1'))?.isWithdrawn).toBe(false);
  });

  it('chains a TRACE_RESTORED event carrying the date it cancels', async () => {
    const withdrawn = trace();
    withdrawn.withdraw('DUPLICATE', WITHDRAWN_AT);
    repo.seed(withdrawn);

    await handler.execute(new RestoreTraceCommand(EXPERT_ACTOR, 'trace-1'));

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_RESTORED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      withdrawnAt: WITHDRAWN_AT.toISOString(),
    });
  });

  it('refuses a trace that never left the case', async () => {
    repo.seed(trace());

    await expect(
      handler.execute(new RestoreTraceCommand(EXPERT_ACTOR, 'trace-1')),
    ).rejects.toBeInstanceOf(NotWithdrawnError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('chains nothing when the trace does not exist', async () => {
    await expect(
      handler.execute(new RestoreTraceCommand(EXPERT_ACTOR, 'missing')),
    ).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });
});
