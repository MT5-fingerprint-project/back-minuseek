import { Inject, Logger } from '@nestjs/common';
import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { recordSealSafely } from '../../../../shared/application/record-seal-safely';
import {
  SEAL_REGISTRY,
  type SealRegistryPort,
} from '../../../../shared/domain/ports/seal-registry.port';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FileDigest } from '../../../domain/file-digest.vo';
import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { FingerPosition } from '../../../domain/reference-print/value-objects/finger-position.vo';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
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
import {
  archivedOriginalPath,
  detectImageMimeType,
  storeDisplayableImage,
  thumbnailPath,
} from '../../services/displayable-image';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import { CaseAccessService } from '../../../../access/application/case-access.service';
import { UploadReferencePrintCommand } from './upload-reference-print.command';

@CommandHandler(UploadReferencePrintCommand)
export class UploadReferencePrintHandler implements ICommandHandler<
  UploadReferencePrintCommand,
  { id: string; path: string; url: string; thumbUrl: string | null }
> {
  private readonly logger = new Logger(UploadReferencePrintHandler.name);

  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(IMAGE_CONVERTER)
    private readonly converter: ImageConverterPort,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
    private readonly caseAccess: CaseAccessService,
    @Inject(SEAL_REGISTRY)
    private readonly sealRegistry: SealRegistryPort,
  ) {}

  async execute(cmd: UploadReferencePrintCommand): Promise<{
    id: string;
    path: string;
    url: string;
    thumbUrl: string | null;
  }> {
    await this.caseAccess.assertAccessToCase(cmd.requester, cmd.caseId);
    assertCaseAcceptsWork(
      cmd.caseId,
      await this.caseStatus.findStatus(cmd.caseId),
    );

    const id = this.idGenerator.generate();
    const mimeType = detectImageMimeType(cmd.fileBuffer);
    const stored = await storeDisplayableImage(
      this.storage,
      this.converter,
      cmd.fileBuffer,
      `investigation-case/${cmd.caseId}/reference-prints/${id}`,
      this.logger,
    );

    const referencePrint = ReferencePrint.create({
      id,
      path: stored.path,
      caseId: cmd.caseId,
      sha256: FileDigest.from(stored.receivedSha256),
      displayableSha256: FileDigest.from(stored.displayableSha256),
      thumbPath: stored.thumbPath,
      sourceSize: stored.sourceSize,
      subjectId: cmd.subjectId ?? null,
      position: cmd.position ? FingerPosition.from(cmd.position) : null,
    });

    let link: AuditLink;
    try {
      link = await this.repo.save(referencePrint, {
        eventType: AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: cmd.caseId,
        payload: {
          referencePrintId: id,
          fileSha256: stored.receivedSha256,
          displayableFileSha256: stored.displayableSha256,
          storagePath: stored.path,
          sizeBytes: cmd.fileBuffer.length,
          mimeType,
        },
      });
    } catch (error) {
      await this.discardStoredFile(stored.path);
      const archived = archivedOriginalPath(stored.path);
      if (archived) {
        await this.discardStoredFile(archived);
      }
      await this.discardStoredFile(thumbnailPath(stored.path));
      throw error;
    }

    await recordSealSafely(
      this.sealRegistry,
      {
        sha256: stored.receivedSha256,
        kind: 'REFERENCE_PRINT',
        chainSeq: link.seq,
        sealedAt: link.occurredAt,
        caseId: cmd.caseId,
      },
      this.logger,
    );

    const [url, thumbUrl] = await Promise.all([
      this.storage.getUrl(stored.path),
      stored.thumbPath === null ? null : this.storage.getUrl(stored.thumbPath),
    ]);
    return { id, path: stored.path, url, thumbUrl };
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
