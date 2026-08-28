import { EXPERT_ACTOR } from '../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { ANY_SEAL } from '../../domain/file-digest.fixture';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import { FingerPosition } from '../../domain/reference-print/value-objects/finger-position.vo';
import { InMemoryReferencePrintRepository } from '../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../infrastructure/storage/in-memory-image-storage.adapter';
import type { FamiliarReferencePrintReader } from '../ports/familiar-reference-print.reader';
import { FamiliarPrintDestructionService } from './familiar-print-destruction.service';

const CASE_ID = 'case-1';
const FAMILIAR_KEY = 'investigation-case/case-1/reference-prints/familiar.png';
const FAMILIAR_ARCHIVE =
  'investigation-case/case-1/reference-prints/familiar_original.tif';

class SeededFamiliarReader implements FamiliarReferencePrintReader {
  constructor(private readonly repo: InMemoryReferencePrintRepository) {}

  findDestroyableByCaseId(caseId: string): Promise<ReferencePrint[]> {
    return Promise.resolve(
      [...this.repo.store.values()].filter(
        (print) =>
          print.caseId === caseId &&
          print.subjectId === 'familier' &&
          !print.isImageDestroyed,
      ),
    );
  }
}

class FailingStorage extends InMemoryImageStorageAdapter {
  private calls = 0;

  constructor(
    private readonly failOnCall: number,
    private readonly failure: Error,
  ) {
    super();
  }

  delete(storedPath: string): Promise<void> {
    this.calls += 1;
    return this.calls === this.failOnCall
      ? Promise.reject(this.failure)
      : super.delete(storedPath);
  }
}

describe('FamiliarPrintDestructionService', () => {
  let repo: InMemoryReferencePrintRepository;
  let storage: InMemoryImageStorageAdapter;
  let auditTrail: InMemoryAuditTrailAppender;

  const print = (
    id: string,
    subjectId: string | null,
    key: string,
  ): ReferencePrint =>
    ReferencePrint.create({
      id,
      path: `media/${key}`,
      caseId: CASE_ID,
      sha256: ANY_SEAL,
      subjectId,
      position: FingerPosition.from('RIGHT_INDEX'),
    });

  const build = (withStorage: InMemoryImageStorageAdapter = storage) =>
    new FamiliarPrintDestructionService(
      new SeededFamiliarReader(repo),
      repo,
      withStorage,
    );

  beforeEach(async () => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryReferencePrintRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();

    repo.seed(print('familiar-1', 'familier', FAMILIAR_KEY));
    repo.seed(
      print(
        'suspect-1',
        'mis-en-cause',
        'investigation-case/case-1/reference-prints/suspect.png',
      ),
    );
    repo.seed(
      print(
        'detachee-1',
        null,
        'investigation-case/case-1/reference-prints/detachee.png',
      ),
    );
    await storage.save(Buffer.from('familier'), FAMILIAR_KEY);
    await storage.save(Buffer.from('tif'), FAMILIAR_ARCHIVE);
    await storage.save(
      Buffer.from('suspect'),
      'investigation-case/case-1/reference-prints/suspect.png',
    );
  });

  it('ne détruit que les images des familiers, avec leur original archivé', async () => {
    const { destroyedCount } = await build().destroyForCase(
      CASE_ID,
      EXPERT_ACTOR,
    );

    expect(destroyedCount).toBe(1);
    expect(storage.getSaved(FAMILIAR_KEY)).toBeUndefined();
    expect(storage.getSaved(FAMILIAR_ARCHIVE)).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-1/reference-prints/suspect.png',
      ),
    ).toBeDefined();
  });

  it('laisse la fiche en base, marquée de sa date de destruction', async () => {
    await build().destroyForCase(CASE_ID, EXPERT_ACTOR);

    const destroyed = await repo.findById('familiar-1');
    expect(destroyed?.isImageDestroyed).toBe(true);
    expect(destroyed?.imageDestroyedAt).toBeInstanceOf(Date);
    expect((await repo.findById('suspect-1'))?.isImageDestroyed).toBe(false);
    expect((await repo.findById('detachee-1'))?.isImageDestroyed).toBe(false);
  });

  it('inscrit un acte par empreinte, sans aucun nom dans la charge utile', async () => {
    await build().destroyForCase(CASE_ID, EXPERT_ACTOR);

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(
      AuditEventTypeEnum.REFERENCE_PRINT_IMAGE_DESTROYED,
    );
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe(CASE_ID);
    expect(event.traceId).toBeNull();
    expect(event.payload).toEqual({
      referencePrintId: 'familiar-1',
      subjectId: 'familier',
      position: 'RIGHT_INDEX',
      storagePath: `media/${FAMILIAR_KEY}`,
      fileSha256: ANY_SEAL.getValue(),
    });
  });

  it("ignore une empreinte déjà détruite lors d'une seconde exécution", async () => {
    const service = build();
    await service.destroyForCase(CASE_ID, EXPERT_ACTOR);

    const { destroyedCount } = await service.destroyForCase(
      CASE_ID,
      EXPERT_ACTOR,
    );

    expect(destroyedCount).toBe(0);
    expect(auditTrail.events).toHaveLength(1);
  });

  it('garde la première détruite quand le stockage lève sur la deuxième', async () => {
    repo.seed(
      print(
        'familiar-2',
        'familier',
        'investigation-case/case-1/reference-prints/familiar-2.png',
      ),
    );
    const failure = new Error('stockage injoignable');
    const failing = new FailingStorage(3, failure);

    await expect(
      build(failing).destroyForCase(CASE_ID, EXPERT_ACTOR),
    ).rejects.toBe(failure);

    expect((await repo.findById('familiar-1'))?.isImageDestroyed).toBe(true);
    expect((await repo.findById('familiar-2'))?.isImageDestroyed).toBe(false);
    expect(auditTrail.events).toHaveLength(1);
  });
});
