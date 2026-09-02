import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { LocationPhotoAlreadyAttachedError } from '../../../domain/trace-location-photo/errors/location-photo-already-attached.error';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryTraceLocationPhotoRepository } from '../../../infrastructure/persistence/in-memory-trace-location-photo.repository';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryImageConverter } from '../../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { UnsupportedImageFormatError } from '../../services/displayable-image';
import { AttachLocationPhotoCommand } from './attach-location-photo.command';
import { AttachLocationPhotoHandler } from './attach-location-photo.handler';

const PHOTO_KEY = 'investigation-case/case-9/location-photos/photo-1.png';
const PHOTO_SHA256 =
  '3d3aec9f22cd0405be09f51d9ba3e4ec270140b3fa2265ca7cafcd08ddff7332';

const photoBuffer = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  Buffer.from('location-photo'),
]);

describe('AttachLocationPhotoHandler', () => {
  let handler: AttachLocationPhotoHandler;
  let traces: InMemoryTraceRepository;
  let locationPhotos: InMemoryTraceLocationPhotoRepository;
  let storage: InMemoryImageStorageAdapter;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;
  let idGenerator: IdGenerator;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    traces = new InMemoryTraceRepository(auditTrail);
    locationPhotos = new InMemoryTraceLocationPhotoRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-9', 'OPEN');
    idGenerator = { generate: jest.fn().mockReturnValue('photo-1') };
    handler = new AttachLocationPhotoHandler(
      traces,
      locationPhotos,
      storage,
      new InMemoryImageConverter(),
      idGenerator,
      caseStatus,
    );

    traces.seed(
      Trace.upload({
        id: 'trace-1',
        number: 1,
        path: 'media/investigation-case/case-9/traces/trace-1.png',
        caseId: 'case-9',
        sha256: ANY_SEAL,
      }),
    );
  });

  const attach = (traceId = 'trace-1', buffer = photoBuffer) =>
    handler.execute(
      new AttachLocationPhotoCommand(EXPERT_ACTOR, traceId, buffer),
    );

  it('verse la photographie, la scelle et rend son adresse signée', async () => {
    const attached = await attach();

    expect(attached).toEqual({
      id: 'photo-1',
      url: `/media/${PHOTO_KEY}`,
      thumbUrl: `/media/${PHOTO_KEY.replace('.png', '_thumb.webp')}`,
      sealedAt: auditTrail.events[0].occurredAt,
    });
    expect(storage.getSaved(PHOTO_KEY)?.equals(photoBuffer)).toBe(true);
    expect((await locationPhotos.findByTraceId('trace-1'))?.sha256).toBe(
      PHOTO_SHA256,
    );
  });

  it('garde le chemin de la vignette sur la photographie versée', async () => {
    await attach();

    expect((await locationPhotos.findByTraceId('trace-1'))?.thumbPath).toBe(
      'media/investigation-case/case-9/location-photos/photo-1_thumb.webp',
    );
  });

  it('verse la photographie sans vignette quand la vignette échoue', async () => {
    const undecodableThumbnail = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      Buffer.from('invalid'),
    ]);

    await attach('trace-1', undecodableThumbnail);

    const photo = await locationPhotos.findByTraceId('trace-1');
    expect(photo?.thumbPath).toBeNull();
    expect(photo?.path).toBe(`media/${PHOTO_KEY}`);
  });

  it('inscrit un LOCATION_PHOTO_UPLOADED constaté', async () => {
    await attach();

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.LOCATION_PHOTO_UPLOADED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      locationPhotoId: 'photo-1',
      fileSha256: PHOTO_SHA256,
      storagePath: `media/${PHOTO_KEY}`,
      sizeBytes: photoBuffer.length,
      mimeType: 'image/png',
    });
  });

  it('refuse une trace inexistante sans rien stocker ni inscrire', async () => {
    await expect(attach('missing')).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
    expect(storage.getSaved(PHOTO_KEY)).toBeUndefined();
  });

  it('refuse une seconde photographie sur la même trace', async () => {
    await attach();
    (idGenerator.generate as jest.Mock).mockReturnValue('photo-2');

    await expect(attach()).rejects.toBeInstanceOf(
      LocationPhotoAlreadyAttachedError,
    );
    expect(auditTrail.events).toHaveLength(1);
    expect(
      storage.getSaved('investigation-case/case-9/location-photos/photo-2.png'),
    ).toBeUndefined();
  });

  it('refuse de verser sur une affaire close', async () => {
    caseStatus.set('case-9', 'CLOSED');

    await expect(attach()).rejects.toBeInstanceOf(CaseNotOpenForWorkError);
    expect(auditTrail.events).toHaveLength(0);
    expect(storage.getSaved(PHOTO_KEY)).toBeUndefined();
  });

  it('refuse un fichier qui n’est ni PNG, ni JPEG, ni TIFF', async () => {
    await expect(
      attach('trace-1', Buffer.from('ceci-n-est-pas-une-image')),
    ).rejects.toBeInstanceOf(UnsupportedImageFormatError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('supprime le fichier versé quand la transaction échoue', async () => {
    const failure = new Error('rollback');
    jest.spyOn(locationPhotos, 'save').mockRejectedValue(failure);

    await expect(attach()).rejects.toBe(failure);

    expect(storage.getSaved(PHOTO_KEY)).toBeUndefined();
  });
});
