import { Inject, Logger } from '@nestjs/common';
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
  CASE_REPORT_DATA_READER,
  type CaseReportData,
  type CaseReportDataReader,
  type PieceData,
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
  ) {}

  async execute(command: GenerateReportCommand): Promise<GeneratedReport> {
    const data = await this.caseData.read(command.caseId);
    if (!data) {
      throw new CaseNotFoundForReportError(command.caseId);
    }

    const reportId = this.idGenerator.generate();
    const generatedAt = new Date();
    const chainHead = await this.chainHead.read();
    const model = await this.buildModel(command, data, {
      reportId,
      chainHead,
      generatedAt,
    });

    const pdf = await this.renderer.render(model);
    const sha256 = createHash('sha256').update(pdf).digest('hex');
    const storagePath = await this.storage.save(
      pdf,
      `reports/${command.caseId}/${reportId}.pdf`,
    );

    try {
      await this.repository.save(
        Report.seal({
          id: reportId,
          caseId: command.caseId,
          type: command.type,
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

    return { id: reportId, sha256 };
  }

  private async buildModel(
    command: GenerateReportCommand,
    data: CaseReportData,
    seal: {
      reportId: string;
      chainHead: { seq: number; hash: string } | null;
      generatedAt: Date;
    },
  ): Promise<ReportViewModel> {
    if (command.type === 'TECHNICAL') {
      const [images, chainEvents, anchors] = await Promise.all([
        this.imagesOf(
          [...data.traces, ...data.referencePrints].filter(
            (piece) =>
              piece.withdrawnAt === null && piece.imageDestroyedAt === null,
          ),
        ),
        this.traceabilityData.readCaseEvents(command.caseId),
        this.traceabilityData.readAnchors(),
      ]);
      return buildTechnicalReport({
        data,
        chainEvents,
        anchors,
        reportId: seal.reportId,
        chainHead: seal.chainHead,
        generatedAt: seal.generatedAt,
        generatedByDisplayName: command.actor.toPrimitives().displayName,
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
      chainHead: seal.chainHead,
      generatedAt: seal.generatedAt,
      generatedByDisplayName: command.actor.toPrimitives().displayName,
      data: traceabilityData,
      attestation,
    });
  }

  /**
   * Les images sont embarquées en data-URL : le PDF scellé ne doit pas dépendre
   * d'une URL signée qui expire. Leurs dimensions natives sont nécessaires pour
   * replacer les minuties, relevées dans le repère pixel de l'image.
   */
  private async imagesOf(
    pieces: PieceData[],
  ): Promise<Map<string, ReportImageViewModel | null>> {
    const entries = await Promise.all(
      pieces.map(
        async (piece) =>
          [piece.path, await this.imageEmbedder.embed(piece.path)] as const,
      ),
    );
    return new Map(entries);
  }
}
