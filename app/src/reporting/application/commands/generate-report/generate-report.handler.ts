import { Inject, Logger } from '@nestjs/common';
import type { AuditLink } from '../../../../shared/domain/ports/audit-trail.port';
import { anchorChainSafely } from '../../../../shared/application/anchor-chain-safely';
import { recordSealSafely } from '../../../../shared/application/record-seal-safely';
import {
  CHAIN_ANCHORING,
  type ChainAnchoringPort,
} from '../../../../shared/domain/ports/chain-anchoring.port';
import {
  SEAL_REGISTRY,
  type SealRegistryPort,
} from '../../../../shared/domain/ports/seal-registry.port';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { Report } from '../../../domain/report/entity/report';
import { CaseNotFoundForReportError } from '../../../domain/report/errors/case-not-found-for-report.error';
import {
  REPORT_REPOSITORY,
  type ReportRepository,
} from '../../../domain/report/repository/report.repository';
import {
  CASE_CONTRIBUTORS_READER,
  type CaseContributorsReader,
} from '../../ports/case-contributors.reader';
import {
  CASE_REPORT_DATA_READER,
  type CaseReportData,
  type CaseReportDataReader,
} from '../../ports/case-report-data.reader';
import {
  CHAIN_ATTESTATION,
  type ChainAttestationPort,
} from '../../ports/chain-attestation.port';
import {
  CHAIN_HEAD_READER,
  type ChainHeadReader,
} from '../../ports/chain-head.reader';
import {
  REPORT_NUMBERING_READER,
  type PreviousDocumentData,
  type ReportNumberingReader,
} from '../../ports/report-numbering.reader';
import { ReportSignerData } from '../../report-signer';
import {
  SERVICE_LETTERHEAD_READER,
  type ServiceLetterheadData,
  type ServiceLetterheadReader,
} from '../../ports/service-letterhead.reader';
import {
  VERIFICATION_URL,
  type VerificationUrlPort,
} from '../../ports/verification-url.port';
import {
  REPORT_IMAGE_EMBEDDER,
  type ReportImageEmbedderPort,
} from '../../ports/report-image-embedder.port';
import {
  REPORT_RENDERER,
  type ReportRendererPort,
} from '../../ports/report-renderer.port';
import {
  REPORT_STORAGE,
  type ReportStoragePort,
} from '../../ports/report-storage.port';
import {
  TRACEABILITY_DATA_READER,
  type TraceabilityDataReader,
} from '../../ports/traceability-data.reader';
import {
  printedImages,
  type PrintedImageRequest,
} from '../../queries/build-report/printed-pieces';
import { buildTechnicalReport } from '../../queries/build-report/technical-report.builder';
import { buildTraceabilityReport } from '../../queries/build-report/traceability-report.builder';
import { ReportImageViewModel, ReportViewModel } from '../../report-view-model';
import { GenerateReportCommand } from './generate-report.command';

export interface GeneratedReport {
  id: string;
  sha256: string;
}

@CommandHandler(GenerateReportCommand)
export class GenerateReportHandler implements ICommandHandler<GenerateReportCommand> {
  private readonly logger = new Logger(GenerateReportHandler.name);

  constructor(
    @Inject(CASE_REPORT_DATA_READER)
    private readonly caseData: CaseReportDataReader,
    @Inject(TRACEABILITY_DATA_READER)
    private readonly traceabilityData: TraceabilityDataReader,
    @Inject(CHAIN_ATTESTATION)
    private readonly chainAttestation: ChainAttestationPort,
    @Inject(CHAIN_HEAD_READER)
    private readonly chainHead: ChainHeadReader,
    @Inject(REPORT_NUMBERING_READER)
    private readonly numbering: ReportNumberingReader,
    @Inject(CASE_CONTRIBUTORS_READER)
    private readonly contributors: CaseContributorsReader,
    @Inject(SERVICE_LETTERHEAD_READER)
    private readonly letterhead: ServiceLetterheadReader,
    @Inject(VERIFICATION_URL)
    private readonly verificationUrl: VerificationUrlPort,
    @Inject(REPORT_IMAGE_EMBEDDER)
    private readonly imageEmbedder: ReportImageEmbedderPort,
    @Inject(REPORT_RENDERER)
    private readonly renderer: ReportRendererPort,
    @Inject(REPORT_STORAGE)
    private readonly storage: ReportStoragePort,
    @Inject(REPORT_REPOSITORY)
    private readonly repository: ReportRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(SEAL_REGISTRY)
    private readonly sealRegistry: SealRegistryPort,
    @Inject(CHAIN_ANCHORING)
    private readonly anchoring: ChainAnchoringPort,
  ) {}

  async execute(command: GenerateReportCommand): Promise<GeneratedReport> {
    const data = await this.caseData.read(command.caseId);
    if (!data) {
      throw new CaseNotFoundForReportError(command.caseId);
    }

    // Le numéro est attribué avant le rendu : le document l'imprime.
    const numbering = await this.numbering.read(command.caseId, command.type);
    const sequence = numbering.lastSequence + 1;
    const number = `${data.investigationCase.caseNumber}-R${sequence}`;

    const reportId = this.idGenerator.generate();
    const generatedAt = new Date();
    // Avant le rendu : le document ne peut nommer que les ancres déjà posées.
    await anchorChainSafely(this.anchoring, this.logger);
    const [chainHead, letterhead] = await Promise.all([
      this.chainHead.read(),
      this.letterhead.read(),
    ]);
    const model = await this.buildModel(command, data, {
      letterhead,
      reportId,
      reportNumber: number,
      signer: command.signer,
      previousDocument: numbering.previousOfType,
      chainHead,
      generatedAt,
    });

    const pdf = await this.renderer.render(model);
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    const storagePath = await this.storage.save(
      pdf,
      `reports/${command.caseId}/${reportId}.pdf`,
    );

    let link: AuditLink;
    try {
      link = await this.repository.save(
        Report.seal({
          id: reportId,
          caseId: command.caseId,
          type: command.type,
          sequence,
          number,
          signerUserId: command.signer.id,
          journalDetail: command.journalDetail,
          storagePath,
          sha256,
          generatedBy: command.actor.toPrimitives(),
          createdAt: generatedAt,
        }),
        {
          eventType: AuditEventTypeEnum.REPORT_GENERATED,
          evidenceClass: EvidenceClassEnum.OBSERVED,
          actor: command.actor,
          caseId: command.caseId,
          payload: { reportId, type: command.type, sha256, storagePath },
        },
      );
    } catch (error) {
      this.logger.warn(
        `Rapport orphelin dans le stockage: ${storagePath} (${String(error)})`,
      );
      throw error;
    }

    await recordSealSafely(
      this.sealRegistry,
      {
        sha256,
        kind: 'REPORT',
        chainSeq: link.seq,
        sealedAt: link.occurredAt,
        caseId: command.caseId,
        reportType: command.type,
      },
      this.logger,
    );
    // Après le scellement : c'est cette seconde ancre qui date le rapport lui-même.
    await anchorChainSafely(this.anchoring, this.logger);

    return { id: reportId, sha256 };
  }

  private async buildModel(
    command: GenerateReportCommand,
    data: CaseReportData,
    seal: {
      letterhead: ServiceLetterheadData;
      reportId: string;
      reportNumber: string;
      signer: ReportSignerData;
      previousDocument: PreviousDocumentData | null;
      chainHead: { seq: number; hash: string } | null;
      generatedAt: Date;
    },
  ): Promise<ReportViewModel> {
    if (command.type === 'TECHNICAL') {
      const [images, chainEvents, anchors, contributors, attestation] =
        await Promise.all([
          this.imagesOf(printedImages(data)),
          this.traceabilityData.readCaseEvents(command.caseId),
          this.traceabilityData.readAnchors(),
          this.contributors.read(command.caseId),
          this.chainAttestation.attest(),
        ]);
      return buildTechnicalReport({
        data,
        letterhead: seal.letterhead,
        chainEvents,
        anchors,
        contributors,
        signer: seal.signer,
        previousDocument: seal.previousDocument,
        reportId: seal.reportId,
        reportNumber: seal.reportNumber,
        chainHead: seal.chainHead,
        generatedAt: seal.generatedAt,
        generatedByDisplayName: command.actor.toPrimitives().displayName,
        journalDetail: command.journalDetail,
        attestation,
        verificationUrl: this.verificationUrl.build(),
        images,
      });
    }

    const [traceabilityData, attestation] = await Promise.all([
      this.traceabilityData.read(command.caseId),
      this.chainAttestation.attest(),
    ]);

    return buildTraceabilityReport({
      caseNumber: data.investigationCase.caseNumber,
      pvNumber: data.investigationCase.pvNumber,
      caseStatus: data.investigationCase.status,
      openedAt: data.investigationCase.createdAt,
      reportId: seal.reportId,
      reportNumber: seal.reportNumber,
      chainHead: seal.chainHead,
      generatedAt: seal.generatedAt,
      generatedByDisplayName: command.actor.toPrimitives().displayName,
      data: traceabilityData,
      attestation,
      letterhead: seal.letterhead,
    });
  }

  private async imagesOf(
    requests: PrintedImageRequest[],
  ): Promise<Map<string, ReportImageViewModel | null>> {
    const entries = await Promise.all(
      requests.map(
        async (request) =>
          [
            request.key,
            await this.imageEmbedder.embed(request.path, request.resolutionDpi),
          ] as const,
      ),
    );
    return new Map(entries);
  }
}
