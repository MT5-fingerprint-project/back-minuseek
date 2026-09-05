import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { FileDigest } from '../../../domain/file-digest.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { ConcordanceVideo } from '../../../domain/concordance-video/entity/concordance-video';
import { ConcordancePairNotFoundError } from '../../../domain/concordance-video/errors/concordance-pair-not-found.error';
import {
  CONCORDANCE_VIDEO_REPOSITORY,
  ConcordanceVideoRepository,
} from '../../../domain/concordance-video/repository/concordance-video.repository';
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
  concordanceVideoMimeType,
  detectConcordanceVideoExtension,
} from '../../services/concordance-video-format';
import { recordSealSafely } from '../../../../shared/application/record-seal-safely';
import {
  SEAL_REGISTRY,
  type SealRegistryPort,
} from '../../../../shared/domain/ports/seal-registry.port';
import { DepositConcordanceVideoCommand } from './deposit-concordance-video.command';

export interface DepositedConcordanceVideo {
  id: string;
  path: string;
  url: string;
  sha256: string;
}

@CommandHandler(DepositConcordanceVideoCommand)
export class DepositConcordanceVideoHandler implements ICommandHandler<
  DepositConcordanceVideoCommand,
  DepositedConcordanceVideo
> {
  private readonly logger = new Logger(DepositConcordanceVideoHandler.name);

  constructor(
    @Inject(CONCORDANCE_VIDEO_REPOSITORY)
    private readonly repo: ConcordanceVideoRepository,
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
    cmd: DepositConcordanceVideoCommand,
  ): Promise<DepositedConcordanceVideo> {
    // Rien n'est écrit avant d'avoir localisé les deux pièces, et une pièce
    // d'un autre dossier lève la même erreur qu'une pièce inconnue (pas d'IDOR
    // par sondage). Une vidéo dont l'un des deux côtés ment ne démontre rien.
    await this.assertPairBelongsToCase(cmd);

    // Lu dans les octets, jamais dans le nom : un enregistrement dans un format
    // refusé ne convertit rien, il est rejeté.
    const extension = detectConcordanceVideoExtension(cmd.fileBuffer);
    const sha256 = FileDigest.ofBuffer(cmd.fileBuffer).getValue();
    const id = this.idGenerator.generate();

    const path = await this.storage.save(
      cmd.fileBuffer,
      `investigation-case/${cmd.caseId}/concordance-videos/${id}${extension}`,
    );

    let link: AuditLink;
    try {
      const video = ConcordanceVideo.seal({
        id,
        caseId: cmd.caseId,
        traceId: cmd.traceId,
        referencePrintId: cmd.referencePrintId,
        path,
        sha256,
        createdAt: new Date(),
      });
      link = await this.repo.save(video, {
        eventType: AuditEventTypeEnum.CONCORDANCE_VIDEO_DEPOSITED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: cmd.actor,
        caseId: cmd.caseId,
        traceId: cmd.traceId,
        payload: {
          videoId: id,
          fileSha256: sha256,
          storagePath: path,
          sizeBytes: cmd.fileBuffer.length,
          mimeType: concordanceVideoMimeType(extension),
          traceId: cmd.traceId,
          referencePrintId: cmd.referencePrintId,
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
        kind: 'CONCORDANCE_VIDEO',
        chainSeq: link.seq,
        sealedAt: link.occurredAt,
        caseId: cmd.caseId,
      },
      this.logger,
    );

    const url = await this.storage.getUrl(path);
    return { id, path, url, sha256 };
  }

  private async assertPairBelongsToCase(
    cmd: DepositConcordanceVideoCommand,
  ): Promise<void> {
    const [trace, referencePrint] = await Promise.all([
      this.locator.locate(cmd.traceId),
      this.locator.locate(cmd.referencePrintId),
    ]);
    const isTrace = trace !== null && trace.traceId !== null;
    const isReferencePrint =
      referencePrint !== null && referencePrint.traceId === null;
    if (
      !isTrace ||
      !isReferencePrint ||
      trace.caseId !== cmd.caseId ||
      referencePrint.caseId !== cmd.caseId
    ) {
      throw new ConcordancePairNotFoundError(cmd.traceId, cmd.referencePrintId);
    }
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
