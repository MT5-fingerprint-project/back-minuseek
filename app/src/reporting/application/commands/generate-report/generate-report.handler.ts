import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  AUDIT_TRAIL,
  type AuditTrailPort,
} from '../../../../shared/domain/ports/audit-trail.port';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
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
import { ReportViewModel } from '../../report-view-model';
import { GenerateReportCommand } from './generate-report.command';

export interface GeneratedReport {
  id: string;
  sha256: string;
}

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

function mimeTypeOf(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return MIME_TYPES[extension] ?? 'application/octet-stream';
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
    @Inject(REPORT_RENDERER)
    private readonly renderer: ReportRendererPort,
    @Inject(REPORT_STORAGE)
    private readonly storage: ReportStoragePort,
    @Inject(REPORT_REPOSITORY)
    private readonly repository: ReportRepository,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
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
      await this.transactionRunner.run(async () => {
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
        );
        await this.auditTrail.append({
          eventType: AuditEventTypeEnum.REPORT_GENERATED,
          evidenceClass: EvidenceClassEnum.OBSERVED,
          actor: command.actor,
          caseId: command.caseId,
          payload: { reportId, type: command.type, sha256, storagePath },
        });
      });
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
      return buildTechnicalReport({
        data,
        reportId: seal.reportId,
        chainHead: seal.chainHead,
        generatedAt: seal.generatedAt,
        generatedByDisplayName: command.actor.toPrimitives().displayName,
        images: await this.imagesOf([...data.traces, ...data.referencePrints]),
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
   * d'une URL signée qui expire. Une pièce illisible ne fait pas échouer le
   * rapport, elle y est signalée comme non embarquée.
   */
  private async imagesOf(
    pieces: PieceData[],
  ): Promise<Map<string, string | null>> {
    const entries = await Promise.all(
      pieces.map(async (piece) => {
        try {
          const bytes = await this.storage.read(piece.path);
          return [
            piece.path,
            `data:${mimeTypeOf(piece.path)};base64,${bytes.toString('base64')}`,
          ] as const;
        } catch (error) {
          this.logger.warn(
            `Pièce illisible au rendu du rapport: ${piece.path} (${String(error)})`,
          );
          return [piece.path, null] as const;
        }
      }),
    );
    return new Map(entries);
  }
}
