import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ANY_SEAL } from '../../../domain/file-digest.fixture';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { FileDigest } from '../../../domain/file-digest.vo';
import { Trace } from '../../../domain/trace/entity/trace';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import { TraceLocationPhoto } from '../../../domain/trace-location-photo/entity/trace-location-photo';
import { TraceLocationPhotoNotFoundError } from '../../../domain/trace-location-photo/errors/trace-location-photo-not-found.error';
import {
  InvalidWithdrawalDetailError,
  WithdrawalMotiveEnum,
} from '../../../domain/withdrawal/withdrawal.vo';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryTraceLocationPhotoRepository } from '../../../infrastructure/persistence/in-memory-trace-location-photo.repository';
import { InMemoryTraceRepository } from '../../../infrastructure/persistence/in-memory-trace.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { RemoveLocationPhotoCommand } from './remove-location-photo.command';
import { RemoveLocationPhotoHandler } from './remove-location-photo.handler';

const PHOTO_KEY = 'investigation-case/case-9/location-photos/photo-1.png';
const PHOTO_PATH = `media/${PHOTO_KEY}`;
const PHOTO_SEAL = FileDigest.ofBuffer(Buffer.from('location-photo'));

describe('RemoveLocationPhotoHandler', () => {
  let handler: RemoveLocationPhotoHandler;
  let traces: InMemoryTraceRepository;
  let locationPhotos: InMemoryTraceLocationPhotoRepository;
  let storage: InMemoryImageStorageAdapter;
  let caseStatus: InMemoryCaseStatusAdapter;
  let auditTrail: InMemoryAuditTrailAppender;

  beforeEach(async () => {
    auditTrail = new InMemoryAuditTrailAppender();
    traces = new InMemoryTraceRepository(auditTrail);
    locationPhotos = new InMemoryTraceLocationPhotoRepository(auditTrail);
    storage = new InMemoryImageStorageAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-9', 'OPEN');
    handler = new RemoveLocationPhotoHandler(
      traces,
      locationPhotos,
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
    locationPhotos.seed(
      TraceLocationPhoto.attach({
        id: 'photo-1',
        traceId: 'trace-1',
        caseId: 'case-9',
        path: PHOTO_PATH,
        sha256: PHOTO_SEAL,
      }),
    );
    await storage.save(Buffer.from('location-photo'), PHOTO_KEY);
  });

  const remove = (traceId = 'trace-1') =>
    handler.execute(
      new RemoveLocationPhotoCommand(
        EXPERT_ACTOR,
        traceId,
        WithdrawalMotiveEnum.MISFILED,
      ),
    );

  it('détache la photographie du dossier', async () => {
    await remove();

    expect(await locationPhotos.findByTraceId('trace-1')).toBeNull();
  });

  it('laisse les octets scellés dans le stockage', async () => {
    await remove();

    expect(storage.getSaved(PHOTO_KEY)).toBeDefined();
  });

  it('inscrit un LOCATION_PHOTO_DELETED portant le scellé et le motif', async () => {
    await remove();

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.LOCATION_PHOTO_DELETED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      locationPhotoId: 'photo-1',
      storagePath: PHOTO_PATH,
      fileSha256: PHOTO_SEAL.getValue(),
      motive: 'MISFILED',
      motiveDetail: null,
    });
  });

  it("inscrit la phrase de l'opérateur quand le motif est OTHER", async () => {
    await handler.execute(
      new RemoveLocationPhotoCommand(
        EXPERT_ACTOR,
        'trace-1',
        WithdrawalMotiveEnum.OTHER,
        '  le cliché ne montre pas le support  ',
      ),
    );

    const [event] = auditTrail.events;
    expect(event.payload.motive).toBe('OTHER');
    expect(event.payload.motiveDetail).toBe(
      'le cliché ne montre pas le support',
    );
  });

  it('refuse le motif OTHER sans précision, sans rien inscrire', async () => {
    await expect(
      handler.execute(
        new RemoveLocationPhotoCommand(
          EXPERT_ACTOR,
          'trace-1',
          WithdrawalMotiveEnum.OTHER,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidWithdrawalDetailError);

    expect(auditTrail.events).toHaveLength(0);
    expect(await locationPhotos.findByTraceId('trace-1')).not.toBeNull();
  });

  it('refuse une trace qui ne porte aucune photographie, sans rien inscrire', async () => {
    await remove();

    await expect(remove()).rejects.toBeInstanceOf(
      TraceLocationPhotoNotFoundError,
    );
    expect(auditTrail.events).toHaveLength(1);
  });

  it('refuse une trace inexistante', async () => {
    await expect(remove('missing')).rejects.toBeInstanceOf(TraceNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse de retirer sur une affaire close', async () => {
    caseStatus.set('case-9', 'CLOSED');

    await expect(remove()).rejects.toBeInstanceOf(CaseNotOpenForWorkError);
    expect(auditTrail.events).toHaveLength(0);
    expect(await locationPhotos.findByTraceId('trace-1')).not.toBeNull();
  });
});
