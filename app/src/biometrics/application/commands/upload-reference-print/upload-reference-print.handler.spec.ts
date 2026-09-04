import { InMemorySealRegistry } from '../../../../audit-trail/infrastructure/persistence/in-memory-seal-registry';
import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import {
  IN_MEMORY_DISPLAYED_SIZE,
  InMemoryImageConverter,
} from '../../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InvalidImageError } from '../../ports/image-converter.port';
import { UnsupportedImageFormatError } from '../../services/displayable-image';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { ReferencePrintRepository } from '../../../domain/reference-print/repository/reference-print.repository';
import { CaseAccessDeniedError } from '../../../../access/application/case-access-denied.error';
import { CaseAccessService } from '../../../../access/application/case-access.service';
import { InMemoryCaseAccessReader } from '../../../../access/infrastructure/persistence/in-memory-case-access.reader';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { UploadReferencePrintCommand } from './upload-reference-print.command';
import { UploadReferencePrintHandler } from './upload-reference-print.handler';

const TIFF_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const CLEAN_PRINT_SHA256 =
  '752db2b96d9b71f1ae7650aa5b47c569e71473045fad4f54e9290035075d1e66';
const DISPLAYED_PNG_SHA256 =
  '1ec55214849d21d75c878fce5c5f24d6b1d758d9af41e63573a0244478f8cfd9';
const STORED_PATH =
  'media/investigation-case/case-9/reference-prints/ref-456.png';
const MARIE = { id: 'marie', role: UserRoleEnum.OPERATOR };
const LUCIE = { id: 'lucie', role: UserRoleEnum.OPERATOR };

class FailingReferencePrintRepository extends InMemoryReferencePrintRepository {
  constructor(private readonly failure: Error) {
    super();
  }

  save(): Promise<AuditLink> {
    return Promise.reject(this.failure);
  }
}

describe('UploadReferencePrintHandler', () => {
  let handler: UploadReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let storage: InMemoryImageStorageAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let idGenerator: IdGenerator;
  let caseStatus: InMemoryCaseStatusAdapter;
  let sealRegistry: InMemorySealRegistry;

  const buildHandler = (referencePrintRepo: ReferencePrintRepository) =>
    new UploadReferencePrintHandler(
      referencePrintRepo,
      storage,
      idGenerator,
      new InMemoryImageConverter(),
      caseStatus,
      new CaseAccessService(
        new InMemoryCaseAccessReader({
          operators: [{ caseId: 'case-9', userId: MARIE.id }],
        }),
      ),
      sealRegistry,
    );

  beforeEach(() => {
    sealRegistry = new InMemorySealRegistry();
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryReferencePrintRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    idGenerator = { generate: jest.fn().mockReturnValue('ref-456') };
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-9', 'OPEN');
    handler = buildHandler(repo);
  });

  const tiffBuffer = Buffer.concat([TIFF_MAGIC, Buffer.from('clean-print')]);

  const command = () =>
    new UploadReferencePrintCommand(EXPERT_ACTOR, MARIE, tiffBuffer, 'case-9');

  it("refuse le dépôt sur une affaire dont l'appelant n'est pas titulaire, sans écrire ni stocker", async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          EXPERT_ACTOR,
          LUCIE,
          tiffBuffer,
          'case-9',
        ),
      ),
    ).rejects.toThrow(CaseAccessDeniedError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
  });

  it("refuse le dépôt d'un jeton sans compte dans le service", async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          EXPERT_ACTOR,
          null,
          tiffBuffer,
          'case-9',
        ),
      ),
    ).rejects.toThrow(CaseAccessDeniedError);

    expect(await repo.findById('ref-456')).toBeNull();
  });

  it('garde le chemin de la vignette sur l’empreinte déposée', async () => {
    await handler.execute(command());

    expect((await repo.findById('ref-456'))?.thumbPath).toBe(
      'media/investigation-case/case-9/reference-prints/ref-456_thumb.webp',
    );
  });

  it('garde les dimensions du fichier servi sur l’empreinte déposée', async () => {
    await handler.execute(command());

    expect((await repo.findById('ref-456'))?.toPrimitives()).toMatchObject({
      sourceWidth: IN_MEMORY_DISPLAYED_SIZE.width,
      sourceHeight: IN_MEMORY_DISPLAYED_SIZE.height,
    });
  });

  it('dépose l’empreinte sans dimensions quand la mesure échoue', async () => {
    const undecodable = Buffer.concat([PNG_MAGIC, Buffer.from('invalid')]);

    await handler.execute(
      new UploadReferencePrintCommand(
        EXPERT_ACTOR,
        MARIE,
        undecodable,
        'case-9',
      ),
    );

    expect((await repo.findById('ref-456'))?.toPrimitives()).toMatchObject({
      sourceWidth: null,
      sourceHeight: null,
    });
  });

  it('dépose l’empreinte sans vignette quand la vignette échoue', async () => {
    const undecodableThumbnail = Buffer.concat([
      PNG_MAGIC,
      Buffer.from('invalid'),
    ]);

    await handler.execute(
      new UploadReferencePrintCommand(
        EXPERT_ACTOR,
        MARIE,
        undecodableThumbnail,
        'case-9',
      ),
    );

    const saved = await repo.findById('ref-456');
    expect(saved?.thumbPath).toBeNull();
    expect(saved?.path).toBe(STORED_PATH);
  });

  it('converts a TIFF to PNG for display, archives the original under <id>_original.tif and persists the PNG path', async () => {
    const result = await handler.execute(command());

    expect(result).toEqual({
      id: 'ref-456',
      path: STORED_PATH,
      url: `/${STORED_PATH}`,
      thumbUrl: `/${STORED_PATH.replace('.png', '_thumb.webp')}`,
    });

    const saved = await repo.findById('ref-456');
    expect(saved?.path).toBe(STORED_PATH);
    expect(saved?.caseId).toBe('case-9');

    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.png')
        ?.equals(Buffer.concat([Buffer.from('png:'), tiffBuffer])),
    ).toBe(true);
    expect(
      storage
        .getSaved(
          'investigation-case/case-9/reference-prints/ref-456_original.tif',
        )
        ?.equals(tiffBuffer),
    ).toBe(true);
  });

  it('stores a non-TIFF upload as-is, without archive, even with a misleading name', async () => {
    const pngBuffer = Buffer.concat([PNG_MAGIC, Buffer.from('clean-print')]);
    const result = await handler.execute(
      new UploadReferencePrintCommand(EXPERT_ACTOR, MARIE, pngBuffer, 'case-9'),
    );

    expect(result.path).toBe(
      'media/investigation-case/case-9/reference-prints/ref-456.png',
    );
    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.png')
        ?.equals(pngBuffer),
    ).toBe(true);
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
      ),
    ).toBeUndefined();
  });

  it('rejects an unreadable TIFF without storing or persisting anything', async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          EXPERT_ACTOR,
          MARIE,
          Buffer.concat([TIFF_MAGIC, Buffer.from('invalid-image')]),
          'case-9',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidImageError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
      ),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
    expect(auditTrail.events).toHaveLength(0);
  });

  it('rejects a payload that is neither PNG, JPEG nor TIFF without storing anything', async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          EXPERT_ACTOR,
          MARIE,
          Buffer.from('not-an-image'),
          'case-9',
        ),
      ),
    ).rejects.toBeInstanceOf(UnsupportedImageFormatError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
    expect(auditTrail.events).toHaveLength(0);
  });

  it('seals the deposited bytes on the reference print', async () => {
    await handler.execute(command());

    expect((await repo.findById('ref-456'))?.sha256).toBe(CLEAN_PRINT_SHA256);
  });

  it('chains a REFERENCE_PRINT_UPLOADED event carrying the seal of the deposit', async () => {
    await handler.execute(command());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBeNull();
    expect(event.payload).toEqual({
      referencePrintId: 'ref-456',
      fileSha256: CLEAN_PRINT_SHA256,
      displayableFileSha256: DISPLAYED_PNG_SHA256,
      storagePath: STORED_PATH,
      sizeBytes: 15,
      mimeType: 'image/tiff',
    });
    expect(event.payload.displayableFileSha256).not.toBe(CLEAN_PRINT_SHA256);
  });

  it('deletes the stored PNG and the archived original, then rethrows when the save fails', async () => {
    const failure = new Error('rollback');

    await expect(
      buildHandler(new FailingReferencePrintRepository(failure)).execute(
        command(),
      ),
    ).rejects.toBe(failure);

    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
      ),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_thumb.webp',
      ),
    ).toBeUndefined();
  });

  it('keeps the upload when the compensating delete itself fails', async () => {
    const failure = new Error('rollback');
    jest
      .spyOn(storage, 'delete')
      .mockRejectedValue(new Error('storage unreachable'));

    await expect(
      buildHandler(new FailingReferencePrintRepository(failure)).execute(
        command(),
      ),
    ).rejects.toBe(failure);
  });
  it('scelle les deux fichiers d’un dépôt TIFF : celui reçu et celui servi', async () => {
    await handler.execute(command());

    const print = await repo.findById('ref-456');
    expect(print?.sha256).toBe(CLEAN_PRINT_SHA256);
    expect(print?.displayableSha256).toBe(DISPLAYED_PNG_SHA256);
    expect(print?.displayableSha256).not.toBe(print?.sha256);
  });
});
