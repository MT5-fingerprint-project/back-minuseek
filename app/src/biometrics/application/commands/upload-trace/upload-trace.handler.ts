import path from 'node:path';
import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FileDigest } from '../../../domain/file-digest.vo';
import { Trace } from '../../../domain/trace/entity/trace';
import { CaptureMetadata } from '../../../domain/trace/value-objects/capture-metadata.vo';
import {
  TRACE_REPOSITORY,
  TraceRepository,
} from '../../../domain/trace/repository/trace.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  AUDIT_TRAIL,
  AuditTrailPort,
} from '../../../../shared/domain/ports/audit-trail.port';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  TRANSACTION_RUNNER,
  TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
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
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
  ) {}

  async execute(
    cmd: UploadTraceCommand,
  ): Promise<{ id: string; path: string; url: string }> {
    const caseStatus = await this.caseStatus.findStatus(cmd.caseId);
    Trace.assertCaseCanReceiveTrace(cmd.caseId, caseStatus);

    const captureMetadata = CaptureMetadata.of(cmd.capture ?? {});

    const id = this.idGenerator.generate();
    const sha256 = FileDigest.ofBuffer(cmd.fileBuffer);
    const relativePath = `investigation-case/${cmd.caseId}/traces/${id}${this.getExtension(cmd.originalName)}`;
    const storedPath = await this.storage.save(cmd.fileBuffer, relativePath);

    try {
      await this.transactionRunner.run(async () => {
        const trace = Trace.upload({
          id,
          path: storedPath,
          caseId: cmd.caseId,
          sha256,
          captureMetadata,
        });
        await this.repo.save(trace);
        await this.auditTrail.append({
          eventType: AuditEventTypeEnum.TRACE_UPLOADED,
          evidenceClass: EvidenceClassEnum.OBSERVED,
          actor: cmd.actor,
          caseId: cmd.caseId,
          traceId: id,
          payload: {
            fileSha256: sha256.getValue(),
            storagePath: storedPath,
            sizeBytes: cmd.fileBuffer.length,
            mimeType: cmd.mimeType,
          },
        });
      });
    } catch (error) {
      await this.discardStoredFile(storedPath);
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

  private getExtension(originalName: string): string {
    const extension = path.extname(originalName);
    return extension.length > 0 ? extension : '.bin';
  }
}
