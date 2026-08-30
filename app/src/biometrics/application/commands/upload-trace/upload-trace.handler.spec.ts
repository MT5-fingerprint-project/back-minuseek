import { InMemorySealRegistry } from '../../../../audit-trail/infrastructure/persistence/in-memory-seal-registry';
import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { TraceStatusEnum } from '../../../domain/trace/value-objects/trace-status.vo';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { CaseUnavailableForTraceError } from '../../../domain/trace/errors/case-unavailable-for-trace.error';
import { InvalidCaptureMetadataError } from '../../../domain/trace/errors/invalid-capture-metadata.error';
import { CaptureMetadataProps } from '../../../domain/trace/value-objects/capture-metadata.vo';
import { CaptureQualityProps } from '../../../domain/trace/value-objects/capture-quality.vo';
import { InvalidCaptureQualityError } from '../../../domain/trace/errors/invalid-capture-quality.error';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryTraceLocationPhotoRepository } from '../../../infrastructure/persistence/in-memory-trace-location-photo.repository';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryTraceNumberAllocatorAdapter } from '../../../infrastructure/persistence/in-memory-trace-number-allocator.adapter';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { TransactionRunner } from '../../../../shared/domain/ports/transaction-runner';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryImageConverter } from '../../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { TraceRepository } from '../../../domain/trace/repository/trace.repository';
import { InvalidTraceLocationError } from '../../../domain/trace/errors/invalid-trace-location.error';
import { UnsupportedImageFormatError } from '../../services/displayable-image';
import { MAX_TRACE_LOCATION_LENGTH } from '../../../domain/trace/entity/trace';
import { CaseAccessDeniedError } from '../../../../access/application/case-access-denied.error';
import { CaseAccessService } from '../../../../access/application/case-access.service';
import { InMemoryCaseAccessReader } from '../../../../access/infrastructure/persistence/in-memory-case-access.reader';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { UploadTraceCommand } from './upload-trace.command';
import { UploadTraceHandler } from './upload-trace.handler';

const TEST_IMAGE_SHA256 =
  'cd9de65ea00593ca8023392a7b15e60b322c9a10fd57293ccb428cc7c4d1ce76';
const TIFF_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);

const STORED_PATH = 'media/investigation-case/case-9/traces/trace-123.png';
const MARIE = { id: 'marie', role: UserRoleEnum.OPERATOR };
const LUCIE = { id: 'lucie', role: UserRoleEnum.OPERATOR };
const NADIA = { id: 'nadia', role: UserRoleEnum.ADMIN };

class FailingTraceRepository extends InMemoryTraceRepository {
  constructor(private readonly failure: Error) {
    super();
  }

  save(): Promise<AuditLink> {
    return Promise.reject(this.failure);
  }
}

class RollingBackTransactionRunner implements TransactionRunner {
  constructor(
    private readonly allocator: InMemoryTraceNumberAllocatorAdapter,
  ) {}

  async run<T>(work: () => Promise<T>): Promise<T> {
    const snapshot = new Map(this.allocator.counters);
    try {
      return await work();
    } catch (error) {
      this.allocator.counters.clear();
      for (const [caseId, allocated] of snapshot) {
        this.allocator.counters.set(caseId, allocated);
      }
      throw error;
    }
  }
}

describe('UploadTraceHandler', () => {
  let handler: UploadTraceHandler;
  let repo: InMemoryTraceRepository;
  let storage: InMemoryImageStorageAdapter;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let idGenerator: IdGenerator;
  let sealRegistry: InMemorySealRegistry;
  let traceNumbers: InMemoryTraceNumberAllocatorAdapter;
  let locationPhotos: InMemoryTraceLocationPhotoRepository;

  const buildHandler = (
    traceRepo: TraceRepository,
    transactions: TransactionRunner = new InMemoryTransactionRunner(),
  ) =>
    new UploadTraceHandler(
      traceRepo,
      storage,
      idGenerator,
      caseStatus,
      new InMemoryImageConverter(),
      new CaseAccessService(
        new InMemoryCaseAccessReader({
          operators: [{ caseId: 'case-9', userId: MARIE.id }],
        }),
      ),
      sealRegistry,
      traceNumbers,
      transactions,
      locationPhotos,
    );

  beforeEach(() => {
    sealRegistry = new InMemorySealRegistry();
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryTraceRepository(auditTrail);
    locationPhotos = new InMemoryTraceLocationPhotoRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    idGenerator = { generate: jest.fn().mockReturnValue('trace-123') };
    traceNumbers = new InMemoryTraceNumberAllocatorAdapter();
    handler = buildHandler(repo);
  });

  const pngBuffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    Buffer.from('test-image'),
  ]);

  const command = (
    caseId = 'case-9',
    capture?: CaptureMetadataProps,
    captureQuality?: CaptureQualityProps,
  ) =>
    new UploadTraceCommand(
      EXPERT_ACTOR,
      MARIE,
      pngBuffer,
      caseId,
      capture,
      captureQuality,
    );

  it("refuse le dépôt sur une affaire dont l'appelant n'est pas titulaire, sans écrire ni stocker", async () => {
    caseStatus.set('case-9', 'OPEN');

    await expect(
      handler.execute(
        new UploadTraceCommand(EXPERT_ACTOR, LUCIE, pngBuffer, 'case-9'),
      ),
    ).rejects.toThrow(CaseAccessDeniedError);

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
    ).toBeUndefined();
  });

  it("refuse le dépôt d'un jeton sans compte dans le service", async () => {
    caseStatus.set('case-9', 'OPEN');

    await expect(
      handler.execute(
        new UploadTraceCommand(EXPERT_ACTOR, null, pngBuffer, 'case-9'),
      ),
    ).rejects.toThrow(CaseAccessDeniedError);

    expect(await repo.findById('trace-123')).toBeNull();
  });

  it('stores the file under media/{caseId}/traces, persists the trace as RECEIVED and returns id, path and url', async () => {
    caseStatus.set('case-9', 'OPEN');

    const result = await handler.execute(command());

    expect(result).toEqual({
      id: 'trace-123',
      path: STORED_PATH,
      url: `/${STORED_PATH}`,
    });

    const saved = await repo.findById('trace-123');
    expect(saved?.path).toBe(STORED_PATH);
    expect(saved?.status).toBe(TraceStatusEnum.RECEIVED);
    expect(saved?.caseId).toBe('case-9');

    expect(
      storage
        .getSaved('investigation-case/case-9/traces/trace-123.png')
        ?.equals(pngBuffer),
    ).toBe(true);
  });

  it('persists the capture metadata carried by the upload', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(
      command('case-9', {
        width: 3024,
        height: 4032,
        capturedAt: '2026-08-18T10:12:00.000Z',
        orientation: 6,
        focalLength: 6.86,
        deviceModel: 'iPhone 14 Pro',
      }),
    );

    const saved = await repo.findById('trace-123');
    expect(saved?.toPrimitives()).toMatchObject({
      captureWidth: 3024,
      captureHeight: 4032,
      capturedAt: new Date('2026-08-18T10:12:00.000Z'),
      captureOrientation: 6,
      captureFocalLength: 6.86,
      captureDeviceModel: 'iPhone 14 Pro',
    });
  });

  it('persists no capture metadata when the upload carries none', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    const saved = await repo.findById('trace-123');
    expect(saved?.toPrimitives()).toMatchObject({
      captureWidth: null,
      captureHeight: null,
      capturedAt: null,
      captureOrientation: null,
      captureFocalLength: null,
      captureDeviceModel: null,
    });
  });

  it('rejects invalid capture metadata without storing the file nor persisting the trace', async () => {
    caseStatus.set('case-9', 'OPEN');

    await expect(
      handler.execute(command('case-9', { orientation: 42 })),
    ).rejects.toBeInstanceOf(InvalidCaptureMetadataError);

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
    ).toBeUndefined();
  });

  it('persists the capture quality check carried by the upload', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(
      command('case-9', undefined, { blurScore: 128.4, passed: true }),
    );

    const saved = await repo.findById('trace-123');
    expect(saved?.toPrimitives()).toMatchObject({
      captureQuality: { blurScore: 128.4, passed: true },
    });
  });

  it('persists the verdict of a check the phone failed', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(
      command('case-9', undefined, { blurScore: 12.5, passed: false }),
    );

    const saved = await repo.findById('trace-123');
    expect(saved?.toPrimitives()).toMatchObject({
      captureQuality: { blurScore: 12.5, passed: false },
    });
  });

  it('persists no capture quality check when the upload carries none', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    const saved = await repo.findById('trace-123');
    expect(saved?.toPrimitives()).toMatchObject({ captureQuality: null });
  });

  it('rejects an invalid capture quality check without storing the file nor persisting the trace', async () => {
    caseStatus.set('case-9', 'OPEN');

    await expect(
      handler.execute(
        command('case-9', undefined, {
          blurScore: -1,
          passed: true,
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidCaptureQualityError);

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
    ).toBeUndefined();
  });

  it('accepts an upload when the case is IN_PROGRESS', async () => {
    caseStatus.set('case-9', 'IN_PROGRESS');

    const result = await handler.execute(command());

    expect(result.id).toBe('trace-123');
    expect(await repo.findById('trace-123')).not.toBeNull();
  });

  it('seals the deposited bytes on the trace', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    expect((await repo.findById('trace-123'))?.sha256).toBe(TEST_IMAGE_SHA256);
  });

  it('chains a TRACE_UPLOADED event carrying the seal of the deposit', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.TRACE_UPLOADED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBe('trace-123');
    expect(event.payload).toEqual({
      number: 1,
      fileSha256: TEST_IMAGE_SHA256,
      displayableFileSha256: TEST_IMAGE_SHA256,
      storagePath: STORED_PATH,
      sizeBytes: 14,
      mimeType: 'image/png',
    });
  });

  it("numérote les dépôts successifs d'une affaire dans l'ordre", async () => {
    caseStatus.set('case-9', 'OPEN');
    idGenerator.generate = jest
      .fn()
      .mockReturnValueOnce('trace-1')
      .mockReturnValueOnce('trace-2')
      .mockReturnValueOnce('trace-3');

    await handler.execute(command());
    await handler.execute(command());
    await handler.execute(command());

    expect((await repo.findById('trace-1'))?.number).toBe(1);
    expect((await repo.findById('trace-2'))?.number).toBe(2);
    expect((await repo.findById('trace-3'))?.number).toBe(3);
  });

  it('compte séparément les traces de deux affaires', async () => {
    caseStatus.set('case-9', 'OPEN');
    caseStatus.set('case-8', 'OPEN');
    idGenerator.generate = jest
      .fn()
      .mockReturnValueOnce('trace-9a')
      .mockReturnValueOnce('trace-8a');

    await handler.execute(command());
    await handler.execute(
      new UploadTraceCommand(EXPERT_ACTOR, NADIA, pngBuffer, 'case-8'),
    );

    expect((await repo.findById('trace-9a'))?.number).toBe(1);
    expect((await repo.findById('trace-8a'))?.number).toBe(1);
  });

  it("n'avance pas le compteur quand le dépôt échoue", async () => {
    caseStatus.set('case-9', 'OPEN');
    const failing = buildHandler(
      new FailingTraceRepository(new Error('rollback')),
      new RollingBackTransactionRunner(traceNumbers),
    );

    await expect(failing.execute(command())).rejects.toThrow('rollback');
    await handler.execute(command());

    expect((await repo.findById('trace-123'))?.number).toBe(1);
  });

  it('deletes the stored file and rethrows when the save fails', async () => {
    caseStatus.set('case-9', 'OPEN');
    const failure = new Error('rollback');

    await expect(
      buildHandler(new FailingTraceRepository(failure)).execute(command()),
    ).rejects.toBe(failure);

    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
    ).toBeUndefined();
  });

  it('keeps the upload when the compensating delete itself fails', async () => {
    caseStatus.set('case-9', 'OPEN');
    const failure = new Error('rollback');
    jest
      .spyOn(storage, 'delete')
      .mockRejectedValue(new Error('storage unreachable'));

    await expect(
      buildHandler(new FailingTraceRepository(failure)).execute(command()),
    ).rejects.toBe(failure);
  });

  // La responsable de service passe le contrôle d'accès sur n'importe quelle
  // affaire : c'est elle, et plus l'opérateur, qui atteint le contrôle de statut
  // sur une affaire qui n'existe pas.
  it('rejects and persists nothing when the case does not exist', async () => {
    await expect(
      handler.execute(
        new UploadTraceCommand(EXPERT_ACTOR, NADIA, pngBuffer, 'missing-case'),
      ),
    ).rejects.toBeInstanceOf(CaseUnavailableForTraceError);

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/missing-case/traces/trace-123.png'),
    ).toBeUndefined();
    expect(auditTrail.events).toHaveLength(0);
  });

  it('rejects and persists nothing when the case is closed', async () => {
    caseStatus.set('case-9', 'CLOSED');

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      CaseNotOpenForWorkError,
    );

    expect(await repo.findById('trace-123')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
    ).toBeUndefined();
    expect(auditTrail.events).toHaveLength(0);
  });

  it('accepte un dépôt sur une affaire en relecture', async () => {
    caseStatus.set('case-9', 'UNDER_REVIEW');

    await expect(handler.execute(command())).resolves.toBeDefined();
  });
  it('projette le scellé de la trace au registre public, avec son maillon', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    const link = auditTrail.events.at(-1);
    expect(sealRegistry.seals).toEqual([
      {
        tenantSlug: 'demo',
        sha256: auditTrail.events[0].payload.fileSha256,
        kind: 'TRACE',
        chainSeq: link?.seq,
        sealedAt: link?.occurredAt,
        caseId: 'case-9',
        reportType: null,
        anchoredAt: null,
      },
    ]);
  });

  it('ne perd pas un dépôt réussi quand la projection du scellé échoue', async () => {
    caseStatus.set('case-9', 'OPEN');
    sealRegistry.failWith = new Error("base d'administration injoignable");

    const uploaded = await handler.execute(command());

    expect(uploaded.id).toBe('trace-123');
    expect(await repo.findById('trace-123')).not.toBeNull();
    expect(auditTrail.events).toHaveLength(1);
  });

  describe('la localisation consignée sur les lieux', () => {
    const LOCATION = "Sur l'extérieur de la porte d'entrée de l'appartement";
    const PHOTO_KEY =
      'investigation-case/case-9/location-photos/location-photo-1.png';
    const photoBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.from('location-photo'),
    ]);
    const PHOTO_SHA256 =
      '3d3aec9f22cd0405be09f51d9ba3e4ec270140b3fa2265ca7cafcd08ddff7332';

    const upload = (location?: string, photo?: Buffer) =>
      new UploadTraceCommand(
        EXPERT_ACTOR,
        MARIE,
        pngBuffer,
        'case-9',
        undefined,
        undefined,
        location,
        photo,
      );

    beforeEach(() => {
      caseStatus.set('case-9', 'OPEN');
      idGenerator.generate = jest
        .fn()
        .mockReturnValueOnce('trace-123')
        .mockReturnValueOnce('location-photo-1');
    });

    it('écrit la trace, la photographie et les trois actes en une seule opération', async () => {
      await handler.execute(upload(LOCATION, photoBuffer));

      expect(auditTrail.events.map((event) => event.eventType)).toEqual([
        AuditEventTypeEnum.TRACE_UPLOADED,
        AuditEventTypeEnum.LOCATION_PHOTO_UPLOADED,
        AuditEventTypeEnum.TRACE_LOCATION_STATED,
      ]);
      expect(auditTrail.events.map((event) => event.evidenceClass)).toEqual([
        EvidenceClassEnum.OBSERVED,
        EvidenceClassEnum.OBSERVED,
        EvidenceClassEnum.DECLARED,
      ]);

      const [, photoEvent, locationEvent] = auditTrail.events;
      expect(photoEvent.caseId).toBe('case-9');
      expect(photoEvent.traceId).toBe('trace-123');
      expect(photoEvent.payload).toEqual({
        locationPhotoId: 'location-photo-1',
        fileSha256: PHOTO_SHA256,
        storagePath: `media/${PHOTO_KEY}`,
        sizeBytes: photoBuffer.length,
        mimeType: 'image/png',
      });
      expect(locationEvent.payload).toEqual({ location: LOCATION });

      expect((await repo.findById('trace-123'))?.location).toBe(LOCATION);
      expect((await locationPhotos.findByTraceId('trace-123'))?.path).toBe(
        `media/${PHOTO_KEY}`,
      );
      expect(storage.getSaved(PHOTO_KEY)?.equals(photoBuffer)).toBe(true);
    });

    it('scelle la photographie sur les octets reçus', async () => {
      await handler.execute(upload(undefined, photoBuffer));

      expect((await locationPhotos.findByTraceId('trace-123'))?.sha256).toBe(
        PHOTO_SHA256,
      );
      expect(auditTrail.events[1].payload.fileSha256).toBe(PHOTO_SHA256);
    });

    it("n'inscrit qu'un acte quand le dépôt ne porte aucune localisation", async () => {
      await handler.execute(upload());

      expect(auditTrail.events).toHaveLength(1);
      expect(auditTrail.events[0].eventType).toBe(
        AuditEventTypeEnum.TRACE_UPLOADED,
      );
      expect(await locationPhotos.findByTraceId('trace-123')).toBeNull();
    });

    it('accepte une phrase sans photographie', async () => {
      await handler.execute(upload(LOCATION));

      expect(auditTrail.events.map((event) => event.eventType)).toEqual([
        AuditEventTypeEnum.TRACE_UPLOADED,
        AuditEventTypeEnum.TRACE_LOCATION_STATED,
      ]);
      expect((await repo.findById('trace-123'))?.location).toBe(LOCATION);
    });

    it('accepte une photographie sans phrase', async () => {
      await handler.execute(upload(undefined, photoBuffer));

      expect(auditTrail.events.map((event) => event.eventType)).toEqual([
        AuditEventTypeEnum.TRACE_UPLOADED,
        AuditEventTypeEnum.LOCATION_PHOTO_UPLOADED,
      ]);
      expect((await repo.findById('trace-123'))?.location).toBeNull();
    });

    it('refuse une localisation trop longue sans rien stocker', async () => {
      await expect(
        handler.execute(upload('a'.repeat(MAX_TRACE_LOCATION_LENGTH + 1))),
      ).rejects.toBeInstanceOf(InvalidTraceLocationError);

      expect(auditTrail.events).toHaveLength(0);
      expect(
        storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
      ).toBeUndefined();
    });

    it("refuse une photographie illisible avant d'écrire quoi que ce soit", async () => {
      await expect(
        handler.execute(
          upload(LOCATION, Buffer.from('ceci-n-est-pas-une-image')),
        ),
      ).rejects.toBeInstanceOf(UnsupportedImageFormatError);

      expect(auditTrail.events).toHaveLength(0);
      expect(
        storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
      ).toBeUndefined();
      expect(storage.getSaved(PHOTO_KEY)).toBeUndefined();
    });

    it('ne laisse aucun des deux fichiers dans le stockage quand la transaction échoue', async () => {
      const failing = buildHandler(
        new FailingTraceRepository(new Error('rollback')),
      );

      await expect(
        failing.execute(upload(LOCATION, photoBuffer)),
      ).rejects.toThrow('rollback');

      expect(
        storage.getSaved('investigation-case/case-9/traces/trace-123.png'),
      ).toBeUndefined();
      expect(storage.getSaved(PHOTO_KEY)).toBeUndefined();
    });
  });

  it('porte la même empreinte dans les deux colonnes quand rien n’est converti', async () => {
    caseStatus.set('case-9', 'OPEN');

    await handler.execute(command());

    const trace = await repo.findById('trace-123');
    expect(trace?.sha256).toBe(TEST_IMAGE_SHA256);
    expect(trace?.displayableSha256).toBe(TEST_IMAGE_SHA256);
  });
  it('scelle les deux fichiers d’un dépôt TIFF : celui reçu et celui servi', async () => {
    caseStatus.set('case-9', 'OPEN');
    const tiff = Buffer.concat([TIFF_MAGIC, Buffer.from('trace-tiff')]);

    await handler.execute(
      new UploadTraceCommand(EXPERT_ACTOR, MARIE, tiff, 'case-9'),
    );

    const trace = await repo.findById('trace-123');
    expect(trace?.sha256).toBe(
      '22ec5a7824020491a554d2f71f8230afc08b2f8ddef47c21fadacd8c1de2e673',
    );
    expect(trace?.displayableSha256).toBe(
      'e6799bf2d38b8296cd5c17a129723b1bcd81a6d3b582542b1f539726ada1adb3',
    );
    expect(trace?.displayableSha256).not.toBe(trace?.sha256);
  });
});
