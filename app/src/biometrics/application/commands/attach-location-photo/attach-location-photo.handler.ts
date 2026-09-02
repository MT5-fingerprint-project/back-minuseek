import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { FileDigest } from '../../../domain/file-digest.vo';
import { TraceNotFoundError } from '../../../domain/trace/errors/trace-not-found.error';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { TraceLocationPhoto } from '../../../domain/trace-location-photo/entity/trace-location-photo';
import { LocationPhotoAlreadyAttachedError } from '../../../domain/trace-location-photo/errors/location-photo-already-attached.error';
import {
  TRACE_LOCATION_PHOTO_REPOSITORY,
  TraceLocationPhotoRepository,
} from '../../../domain/trace-location-photo/repository/trace-location-photo.repository';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import {
  IMAGE_CONVERTER,
  ImageConverterPort,
} from '../../ports/image-converter.port';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import {
  archivedOriginalPath,
  detectImageMimeType,
  storeDisplayableImage,
  thumbnailPath,
} from '../../services/displayable-image';
import { AttachLocationPhotoCommand } from './attach-location-photo.command';

export interface AttachedLocationPhoto {
  id: string;
  url: string;
  thumbUrl: string | null;
  sealedAt: Date;
}

@CommandHandler(AttachLocationPhotoCommand)
export class AttachLocationPhotoHandler implements ICommandHandler<
  AttachLocationPhotoCommand,
  AttachedLocationPhoto
> {
  private readonly logger = new Logger(AttachLocationPhotoHandler.name);

  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly traces: TraceRepository,
    @Inject(TRACE_LOCATION_PHOTO_REPOSITORY)
    private readonly locationPhotos: TraceLocationPhotoRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(IMAGE_CONVERTER)
    private readonly converter: ImageConverterPort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(
    cmd: AttachLocationPhotoCommand,
  ): Promise<AttachedLocationPhoto> {
    const trace = await this.traces.findById(cmd.traceId);
    if (!trace) {
      throw new TraceNotFoundError(cmd.traceId);
    }

    assertCaseAcceptsWork(
      trace.caseId,
      await this.caseStatus.findStatus(trace.caseId),
    );

    if ((await this.locationPhotos.findByTraceId(cmd.traceId)) !== null) {
      throw new LocationPhotoAlreadyAttachedError(cmd.traceId);
    }

    const id = this.idGenerator.generate();
    const mimeType = detectImageMimeType(cmd.fileBuffer);
    const stored = await storeDisplayableImage(
      this.storage,
      this.converter,
      cmd.fileBuffer,
      `investigation-case/${trace.caseId}/location-photos/${id}`,
      this.logger,
    );

    const photo = TraceLocationPhoto.attach({
      id,
      traceId: trace.id,
      caseId: trace.caseId,
      path: stored.path,
      sha256: FileDigest.from(stored.receivedSha256),
      thumbPath: stored.thumbPath,
    });

    let sealedAt: Date;
    try {
      const link = await this.locationPhotos.save(photo, {
        eventType: AuditEventTypeEnum.LOCATION_PHOTO_UPLOADED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: trace.caseId,
        traceId: trace.id,
        payload: {
          locationPhotoId: id,
          fileSha256: stored.receivedSha256,
          storagePath: stored.path,
          sizeBytes: cmd.fileBuffer.length,
          mimeType,
        },
      });
      sealedAt = link.occurredAt;
    } catch (error) {
      await this.discardStoredFile(stored.path);
      const archived = archivedOriginalPath(stored.path);
      if (archived) {
        await this.discardStoredFile(archived);
      }
      await this.discardStoredFile(thumbnailPath(stored.path));
      throw error;
    }

    const [url, thumbUrl] = await Promise.all([
      this.storage.getUrl(stored.path),
      stored.thumbPath === null ? null : this.storage.getUrl(stored.thumbPath),
    ]);
    return { id, url, thumbUrl, sealedAt };
  }

  private async discardStoredFile(storedPath: string): Promise<void> {
    try {
      await this.storage.delete(storedPath);
    } catch (error) {
      this.logger.warn(
        `Fichier orphelin dans le stockage: ${storedPath} (${String(error)})`,
      );
    }
  }
}
