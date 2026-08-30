import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InvalidImageResolutionError } from '../../../domain/image-resolution.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { CalibrateTraceCommand } from './calibrate-trace.command';
import { CalibrateTraceHandler } from './calibrate-trace.handler';

const STORED_PATH = 'media/investigation-case/case-1/traces/trace-1.png';

describe('CalibrateTraceHandler', () => {
  let handler: CalibrateTraceHandler;
  let repo: InMemoryTraceRepository;
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
    handler = new CalibrateTraceHandler(repo);
    repo.seed(seededTrace());
  });

  it('writes the resolution onto the trace', async () => {
    await handler.execute(
      new CalibrateTraceCommand(EXPERT_ACTOR, 'trace-1', 1207.34),
    );

    const trace = await repo.findById('trace-1');
    expect(trace?.resolutionDpi).toBe(1207.34);
  });

  it('chains a TRACE_CALIBRATED event carrying the resolution', async () => {
    await handler.execute(
      new CalibrateTraceCommand(EXPERT_ACTOR, 'trace-1', 1207.34),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_CALIBRATED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.DECLARED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      resolutionDpi: 1207.34,
      previousResolutionDpi: null,
    });
  });

  it('carries both the previous and the new resolution on a recalibration', async () => {
    await handler.execute(
      new CalibrateTraceCommand(EXPERT_ACTOR, 'trace-1', 500),
    );

    await handler.execute(
      new CalibrateTraceCommand(EXPERT_ACTOR, 'trace-1', 600),
    );

    expect(auditTrail.events).toHaveLength(2);
    const [, second] = auditTrail.events;
    expect(second.payload).toEqual({
      resolutionDpi: 600,
      previousResolutionDpi: 500,
    });
  });

  it('rejects an unknown piece and chains nothing', async () => {
    await expect(
      handler.execute(new CalibrateTraceCommand(EXPERT_ACTOR, 'missing', 500)),
    ).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuses a resolution outside the accepted range, chains nothing and leaves the value untouched', async () => {
    await handler.execute(
      new CalibrateTraceCommand(EXPERT_ACTOR, 'trace-1', 500),
    );

    await expect(
      handler.execute(new CalibrateTraceCommand(EXPERT_ACTOR, 'trace-1', 3)),
    ).rejects.toBeInstanceOf(InvalidImageResolutionError);

    expect(auditTrail.events).toHaveLength(1);
    const trace = await repo.findById('trace-1');
    expect(trace?.resolutionDpi).toBe(500);
  });
});
