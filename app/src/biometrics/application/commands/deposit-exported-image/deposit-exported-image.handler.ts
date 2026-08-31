import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { FileDigest } from '../../../domain/file-digest.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ExportedImage } from '../../../domain/exported-image/entity/exported-image';
import { ExportSourcePieceNotFoundError } from '../../../domain/exported-image/errors/export-source-piece-not-found.error';
import {
  EXPORTED_IMAGE_REPOSITORY,
  ExportedImageRepository,
} from '../../../domain/exported-image/repository/exported-image.repository';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import {
  FINGERPRINT_LOCATOR,
  FingerprintLocatorPort,
} from '../../ports/fingerprint-locator.port';
import {
  detectExportImageExtension,
  exportImageMimeType,
} from '../../services/export-image-format';
import { recordSealSafely } from '../../../../shared/application/record-seal-safely';
import {
  SEAL_REGISTRY,
  type SealRegistryPort,
} from '../../../../shared/domain/ports/seal-registry.port';
import { DepositExportedImageCommand } from './deposit-exported-image.command';

export interface DepositedExportedImage {
  id: string;
  path: string;
  url: string;
  sha256: string;
}

@CommandHandler(DepositExportedImageCommand)
export class DepositExportedImageHandler implements ICommandHandler<
  DepositExportedImageCommand,
  DepositedExportedImage
> {
  private readonly logger = new Logger(DepositExportedImageHandler.name);

  constructor(
    @Inject(EXPORTED_IMAGE_REPOSITORY)
    private readonly repo: ExportedImageRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly locator: FingerprintLocatorPort,
    @Inject(SEAL_REGISTRY)
    private readonly sealRegistry: SealRegistryPort,
  ) {}

  async execute(
    cmd: DepositExportedImageCommand,
  ): Promise<DepositedExportedImage> {
    // Rien n'est écrit avant d'avoir localisé la pièce : une pièce inconnue et
    // une pièce d'un autre dossier lèvent la même erreur (pas d'IDOR par sondage).
    const location = await this.locator.locate(cmd.sourcePieceId);
    if (!location || location.caseId !== cmd.caseId) {
      throw new ExportSourcePieceNotFoundError(cmd.sourcePieceId);
    }
    const sourceKind = location.traceId !== null ? 'TRACE' : 'REFERENCE_PRINT';

    // Lu dans les octets, jamais dans le nom : un export au format refusé ne
    // convertit rien, contrairement au dépôt d'une trace.
    const extension = detectExportImageExtension(cmd.fileBuffer);
    const sha256 = FileDigest.ofBuffer(cmd.fileBuffer).getValue();
    const id = this.idGenerator.generate();

    const path = await this.storage.save(
      cmd.fileBuffer,
      `investigation-case/${cmd.caseId}/exports/${id}${extension}`,
    );

    let link: AuditLink;
    try {
      const image = ExportedImage.seal({
        id,
        caseId: cmd.caseId,
        sourcePieceId: cmd.sourcePieceId,
        sourceKind,
        path,
        sha256,
        createdAt: new Date(),
      });
      link = await this.repo.save(image, {
        eventType: AuditEventTypeEnum.EXPORTED_IMAGE_DEPOSITED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: cmd.caseId,
        traceId: sourceKind === 'TRACE' ? cmd.sourcePieceId : null,
        payload: {
          exportId: id,
          fileSha256: sha256,
          storagePath: path,
          sizeBytes: cmd.fileBuffer.length,
          mimeType: exportImageMimeType(extension),
          sourcePieceId: cmd.sourcePieceId,
          sourceKind,
        },
      });
    } catch (error) {
      await this.discardStoredFile(path);
      throw error;
    }

    await recordSealSafely(
      this.sealRegistry,
      {
        sha256,
        kind: 'EXPORTED_IMAGE',
        chainSeq: link.seq,
        sealedAt: link.occurredAt,
        caseId: cmd.caseId,
      },
      this.logger,
    );

    const url = await this.storage.getUrl(path);
    return { id, path, url, sha256 };
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
