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
import { InMemoryTraceLocationPhotoRepository } from '../../../infrastructure/persistence/in-memory-trace-location-photo.repository';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { FileDigest } from '../../../domain/file-digest.vo';
import { TraceLocationPhoto } from '../../../domain/trace-location-photo/entity/trace-location-photo';
import { TraceRepository } from '../../../domain/trace/repository/trace.repository';
import { WithdrawTraceCommand } from './withdraw-trace.command';
import { WithdrawTraceHandler } from './withdraw-trace.handler';

const STORED_KEY = 'investigation-case/case-1/traces/trace-1.png';
const ARCHIVED_KEY = 'investigation-case/case-1/traces/trace-1_original.tif';
const STORED_PATH = `media/${STORED_KEY}`;
const PHOTO_KEY = 'investigation-case/case-1/location-photos/photo-1.png';
const PHOTO_PATH = `media/${PHOTO_KEY}`;
const PHOTO_SEAL = FileDigest.ofBuffer(Buffer.from('location-photo'));

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
  let locationPhotos: InMemoryTraceLocationPhotoRepository;

  const buildHandler = (traceRepo: TraceRepository) =>
    new WithdrawTraceHandler(
      traceRepo,
      caseStatus,
      locationPhotos,
      new InMemoryTransactionRunner(),
    );

  const seededLocationPhoto = () =>
    TraceLocationPhoto.attach({
      id: 'photo-1',
      traceId: 'trace-1',
      caseId: 'case-1',
      path: PHOTO_PATH,
      sha256: PHOTO_SEAL,
    });

  const seededTrace = () =>
    Trace.upload({
      id: 'trace-1',
      number: 1,
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
    locationPhotos = new InMemoryTraceLocationPhotoRepository(auditTrail);
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

  it('inscrit le retrait de la photographie de localisation avec celui de sa trace', async () => {
    locationPhotos.seed(seededLocationPhoto());
    await storage.save(Buffer.from('location-photo'), PHOTO_KEY);

    await handler.execute(
      new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'MISFILED'),
    );

    expect(auditTrail.events.map((event) => event.eventType)).toEqual([
      AuditEventTypeEnum.TRACE_DELETED,
      AuditEventTypeEnum.LOCATION_PHOTO_DELETED,
    ]);
    const [, photoEvent] = auditTrail.events;
    expect(photoEvent.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(photoEvent.caseId).toBe('case-1');
    expect(photoEvent.traceId).toBe('trace-1');
    expect(photoEvent.payload).toEqual({
      locationPhotoId: 'photo-1',
      storagePath: PHOTO_PATH,
      fileSha256: PHOTO_SEAL.getValue(),
      motive: 'MISFILED',
    });
    expect(storage.getSaved(PHOTO_KEY)).toBeDefined();
  });

  it("n'inscrit qu'un acte quand la trace ne porte aucune photographie", async () => {
    await handler.execute(
      new WithdrawTraceCommand(EXPERT_ACTOR, 'trace-1', 'DUPLICATE'),
    );

    expect(auditTrail.events).toHaveLength(1);
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
