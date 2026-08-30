import { Inject, Logger } from '@nestjs/common';
import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { recordSealSafely } from '../../../../shared/application/record-seal-safely';
import {
  SEAL_REGISTRY,
  type SealRegistryPort,
} from '../../../../shared/domain/ports/seal-registry.port';
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
  TRACE_NUMBER_ALLOCATOR,
  TraceNumberAllocatorPort,
} from '../../ports/trace-number-allocator.port';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import {
  archivedOriginalPath,
  detectImageMimeType,
  storeDisplayableImage,
} from '../../services/displayable-image';
import { CaseAccessService } from '../../../../access/application/case-access.service';
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
    private readonly caseAccess: CaseAccessService,
    @Inject(SEAL_REGISTRY)
    private readonly sealRegistry: SealRegistryPort,
    @Inject(TRACE_NUMBER_ALLOCATOR)
    private readonly traceNumbers: TraceNumberAllocatorPort,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactions: TransactionRunner,
  ) {}

  async execute(
    cmd: UploadTraceCommand,
  ): Promise<{ id: string; path: string; url: string }> {
    await this.caseAccess.assertAccessToCase(cmd.requester, cmd.caseId);

    const caseStatus = await this.caseStatus.findStatus(cmd.caseId);
    Trace.assertCaseCanReceiveTrace(cmd.caseId, caseStatus);

    const captureMetadata = CaptureMetadata.of(cmd.capture ?? {});
    const captureQuality =
      cmd.captureQuality === undefined
        ? undefined
        : CaptureQuality.of(cmd.captureQuality);

    const id = this.idGenerator.generate();
    const mimeType = detectImageMimeType(cmd.fileBuffer);
    const stored = await storeDisplayableImage(
      this.storage,
      this.converter,
      cmd.fileBuffer,
      `investigation-case/${cmd.caseId}/traces/${id}`,
    );

    let link: AuditLink;
    try {
      link = await this.transactions.run(async () => {
        const number = await this.traceNumbers.allocate(cmd.caseId);
        const trace = Trace.upload({
          id,
          number,
          path: stored.path,
          caseId: cmd.caseId,
          sha256: FileDigest.from(stored.receivedSha256),
          displayableSha256: FileDigest.from(stored.displayableSha256),
          captureMetadata,
          captureQuality,
        });
        return this.repo.save(trace, {
          eventType: AuditEventTypeEnum.TRACE_UPLOADED,
          evidenceClass: EvidenceClassEnum.OBSERVED,
          actor: cmd.actor,
          caseId: cmd.caseId,
          traceId: id,
          payload: {
            number,
            fileSha256: stored.receivedSha256,
            displayableFileSha256: stored.displayableSha256,
            storagePath: stored.path,
            sizeBytes: cmd.fileBuffer.length,
            mimeType,
          },
        });
      });
    } catch (error) {
      await this.discardStoredFile(stored.path);
      const archived = archivedOriginalPath(stored.path);
      if (archived) {
        await this.discardStoredFile(archived);
      }
      throw error;
    }

    await recordSealSafely(
      this.sealRegistry,
      {
        sha256: stored.receivedSha256,
        kind: 'TRACE',
        chainSeq: link.seq,
        sealedAt: link.occurredAt,
        caseId: cmd.caseId,
      },
      this.logger,
    );

    const url = await this.storage.getUrl(stored.path);
    return { id, path: stored.path, url };
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
