import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { AlreadyWithdrawnError } from '../../../domain/withdrawal/errors/already-withdrawn.error';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { ReferencePrintRepository } from '../../../domain/reference-print/repository/reference-print.repository';
import { WithdrawReferencePrintCommand } from './withdraw-reference-print.command';
import { WithdrawReferencePrintHandler } from './withdraw-reference-print.handler';

const STORED_KEY = 'investigation-case/case-1/reference-prints/ref-1.png';
const ARCHIVED_KEY =
  'investigation-case/case-1/reference-prints/ref-1_original.tif';
const STORED_PATH = `media/${STORED_KEY}`;

class FailingReferencePrintRepository extends InMemoryReferencePrintRepository {
  constructor(private readonly failure: Error) {
    super();
  }

  save(): Promise<void> {
    return Promise.reject(this.failure);
  }
}

describe('WithdrawReferencePrintHandler', () => {
  let handler: WithdrawReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let storage: InMemoryImageStorageAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let caseStatus: InMemoryCaseStatusAdapter;

  const buildHandler = (referencePrintRepo: ReferencePrintRepository) =>
    new WithdrawReferencePrintHandler(referencePrintRepo, caseStatus);

  const seededPrint = () =>
    ReferencePrint.create({
      id: 'ref-1',
      path: STORED_PATH,
      caseId: 'case-1',
      sha256: ANY_SEAL,
    });

  beforeEach(async () => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryReferencePrintRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-1', 'OPEN');
    handler = buildHandler(repo);

    repo.seed(seededPrint());
    await storage.save(Buffer.from('bytes'), STORED_KEY);
    await storage.save(Buffer.from('tif'), ARCHIVED_KEY);
  });

  it('marks the reference print as withdrawn instead of erasing it', async () => {
    await handler.execute(
      new WithdrawReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 'DUPLICATE'),
    );

    const referencePrint = await repo.findById('ref-1');
    expect(referencePrint?.isWithdrawn).toBe(true);
  });

  it('leaves the stored object and its archived original untouched', async () => {
    await handler.execute(
      new WithdrawReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 'DUPLICATE'),
    );

    expect(storage.getSaved(STORED_KEY)).toBeDefined();
    expect(storage.getSaved(ARCHIVED_KEY)).toBeDefined();
  });

  it('chains a REFERENCE_PRINT_DELETED event carrying the motive and the seal', async () => {
    await handler.execute(
      new WithdrawReferencePrintCommand(
        EXPERT_ACTOR,
        'ref-1',
        'WRONG_ATTRIBUTION',
      ),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.REFERENCE_PRINT_DELETED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-1');
    expect(event.payload).toEqual({
      referencePrintId: 'ref-1',
      storagePath: STORED_PATH,
      fileSha256: ANY_SEAL.getValue(),
      motive: 'WRONG_ATTRIBUTION',
    });
  });

  it('refuses to withdraw the same reference print twice', async () => {
    await handler.execute(
      new WithdrawReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 'DUPLICATE'),
    );

    await expect(
      handler.execute(
        new WithdrawReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 'DUPLICATE'),
      ),
    ).rejects.toBeInstanceOf(AlreadyWithdrawnError);
    expect(auditTrail.events).toHaveLength(1);
  });

  it('leaves the piece in place when the transaction fails', async () => {
    const failure = new Error('rollback');
    const failing = new FailingReferencePrintRepository(failure);
    failing.seed(seededPrint());

    await expect(
      buildHandler(failing).execute(
        new WithdrawReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 'DUPLICATE'),
      ),
    ).rejects.toBe(failure);

    expect(storage.getSaved(STORED_KEY)).toBeDefined();
  });

  it('chains nothing when the reference print does not exist', async () => {
    await expect(
      handler.execute(
        new WithdrawReferencePrintCommand(EXPERT_ACTOR, 'missing', 'DUPLICATE'),
      ),
    ).rejects.toBeInstanceOf(ReferencePrintNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });
  it("refuse de retirer une empreinte d'une affaire close, sans rien inscrire", async () => {
    caseStatus.set('case-1', 'CLOSED');

    await expect(
      handler.execute(
        new WithdrawReferencePrintCommand(EXPERT_ACTOR, 'ref-1', 'DUPLICATE'),
      ),
    ).rejects.toBeInstanceOf(CaseNotOpenForWorkError);
    expect(auditTrail.events).toHaveLength(0);
    expect(storage.getSaved(STORED_KEY)).toBeDefined();
  });
});
