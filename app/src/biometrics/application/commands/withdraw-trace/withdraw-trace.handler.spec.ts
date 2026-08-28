import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { AlreadyWithdrawnError } from '../../../domain/withdrawal/errors/already-withdrawn.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { TraceRepository } from '../../../domain/trace/repository/trace.repository';
import { WithdrawTraceCommand } from './withdraw-trace.command';
import { WithdrawTraceHandler } from './withdraw-trace.handler';

const STORED_KEY = 'investigation-case/case-1/traces/trace-1.png';
const ARCHIVED_KEY = 'investigation-case/case-1/traces/trace-1_original.tif';
const STORED_PATH = `media/${STORED_KEY}`;

class FailingTraceRepository extends InMemoryTraceRepository {
  constructor(private readonly failure: Error) {
    super();
  }

  save(): Promise<AuditLink> {
    return Promise.reject(this.failure);
  }
}

describe('WithdrawTraceHandler', () => {
  let handler: WithdrawTraceHandler;
  let repo: InMemoryTraceRepository;
  let storage: InMemoryImageStorageAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let caseStatus: InMemoryCaseStatusAdapter;

  const buildHandler = (traceRepo: TraceRepository) =>
    new WithdrawTraceHandler(traceRepo, caseStatus);

  const seededTrace = () =>
    Trace.upload({
      id: 'trace-1',
      path: STORED_PATH,
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });

  beforeEach(async () => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryTraceRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = buildHandler(repo);

    repo.seed(seededTrace());
    await storage.save(Buffer.from('bytes'), STORED_KEY);
    await storage.save(Buffer.from('tif'), ARCHIVED_KEY);
  });

  it('marks the trace as withdrawn instead of erasing it', async () => {
    await handler.execute(
      new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'DUPLICATE'),
    );

    const trace = await repo.findById('trace-1');
    expect(trace?.isWithdrawn).toBe(true);
  });

  it('leaves the stored object and its archived original untouched', async () => {
    await handler.execute(
      new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'DUPLICATE'),
    );

    expect(storage.getSaved(STORED_KEY)).toBeDefined();
    expect(storage.getSaved(ARCHIVED_KEY)).toBeDefined();
  });

  it('chains a TRACE_DELETED event carrying the motive and the seal', async () => {
    await handler.execute(
      new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'MISFILED'),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_DELETED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      traceId: 'trace-1',
      storagePath: STORED_PATH,
      fileSha256: ANY_SEAL.getValue(),
      motive: 'MISFILED',
    });
  });

  it('refuses to withdraw the same trace twice', async () => {
    await handler.execute(
      new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'DUPLICATE'),
    );

    await expect(
      handler.execute(
        new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'DUPLICATE'),
      ),
    ).rejects.toBeInstanceOf(AlreadyWithdrawnError);
    expect(auditTrail.events).toHaveLength(1);
  });

  it('leaves the piece in place when the transaction fails', async () => {
    const failure = new Error('rollback');
    const failing = new FailingTraceRepository(failure);
    failing.seed(seededTrace());

    await expect(
      buildHandler(failing).execute(
        new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'DUPLICATE'),
      ),
    ).rejects.toBe(failure);

    expect(storage.getSaved(STORED_KEY)).toBeDefined();
  });

  it('chains nothing when the trace does not exist', async () => {
    await expect(
      handler.execute(
        new WithdrawTraceCommand(EXPERT_ACTOR, 'missing', 'DUPLICATE'),
      ),
    ).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });
  it("refuse de retirer une trace d'une affaire close, sans rien inscrire", async () => {
    caseStatus.set('case-1', 'CLOSED');

    await expect(
      handler.execute(
        new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'DUPLICATE'),
      ),
    ).rejects.toBeInstanceOf(CaseNotOpenForWorkError);
    expect(auditTrail.events).toHaveLength(0);
    expect(storage.getSaved(STORED_KEY)).toBeDefined();
  });
});
