import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FileDigest } from '../../../domain/file-digest.vo';
import { Trace } from '../../../domain/trace/entity/trace';
import { CaptureMetadata } from '../../../domain/trace/value-objects/capture-metadata.vo';
import { CaptureQuality } from '../../../domain/trace/value-objects/capture-quality.vo';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import {
  IMAGE_CONVERTER,
  ImageConverterPort,
} from '../../ports/image-converter.port';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import {
  archivedOriginalPath,
  detectImageMimeType,
  storeDisplayableImage,
} from '../../services/displayable-image';
import { UploadTraceCommand } from './upload-trace.command';

@CommandHandler(UploadTraceCommand)
export class UploadTraceHandler implements ICommandHandler<
  UploadTraceCommand,
  { id: string; path: string; url: string }
> {
  private readonly logger = new Logger(UploadTraceHandler.name);

  constructor(
    @Inject(TRACE_REPOSITORY)
    private readonly repo: TraceRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
    @Inject(IMAGE_CONVERTER)
    private readonly converter: ImageConverterPort,
  ) {}

  async execute(
    cmd: UploadTraceCommand,
  ): Promise<{ id: string; path: string; url: string }> {
    const caseStatus = await this.caseStatus.findStatus(cmd.caseId);
    Trace.assertCaseCanReceiveTrace(cmd.caseId, caseStatus);

    const captureMetadata = CaptureMetadata.of(cmd.capture ?? {});
    const captureQuality =
      cmd.captureQuality === undefined
        ? undefined
        : CaptureQuality.of(cmd.captureQuality);

    const id = this.idGenerator.generate();
    const sha256 = FileDigest.ofBuffer(cmd.fileBuffer);
    const mimeType = detectImageMimeType(cmd.fileBuffer);
    const storedPath = await storeDisplayableImage(
      this.storage,
      this.converter,
      cmd.fileBuffer,
      `investigation-case/${cmd.caseId}/traces/${id}`,
    );

    const trace = Trace.upload({
      id,
      path: storedPath,
      caseId: cmd.caseId,
      sha256,
      captureMetadata,
      captureQuality,
    });

    try {
      await this.repo.save(trace, {
        eventType: AuditEventTypeEnum.TRACE_UPLOADED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: cmd.caseId,
        traceId: id,
        payload: {
          fileSha256: sha256.getValue(),
          storagePath: storedPath,
          sizeBytes: cmd.fileBuffer.length,
          mimeType,
        },
      });
    } catch (error) {
      await this.discardStoredFile(storedPath);
      const archived = archivedOriginalPath(storedPath);
      if (archived) {
        await this.discardStoredFile(archived);
      }
      throw error;
    }

    const url = await this.storage.getUrl(storedPath);
    return { id, path: storedPath, url };
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
