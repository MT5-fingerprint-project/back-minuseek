import { CaseReportData, PieceData } from '../../ports/case-report-data.reader';
import {
  ReportPieceViewModel,
  TechnicalReportViewModel,
} from '../../report-view-model';

export interface TechnicalReportInput {
  data: CaseReportData;
  reportId: string;
  chainHead: { seq: number; hash: string } | null;
  generatedAt: Date;
  generatedByDisplayName: string;
  /** Data-URL par chemin de stockage, résolue en amont (null si illisible). */
  images: Map<string, string | null>;
}

function labelOf(piece: PieceData): string {
  const fileName = piece.path.slice(piece.path.lastIndexOf('/') + 1);
  return fileName.length > 0 ? fileName : piece.id;
}

function toPieceViewModel(
  piece: PieceData,
  images: Map<string, string | null>,
): ReportPieceViewModel {
  return {
    label: labelOf(piece),
    sha256: piece.sha256,
    receivedAt: piece.createdAt,
    capturedAt: piece.capturedAt,
    status: piece.status,
    exploitabilityScore: piece.score,
    imageDataUrl: images.get(piece.path) ?? null,
    layers: piece.layers.map((layer) => ({
      name: layer.name,
      type: layer.type,
      zIndex: layer.zIndex,
      isVisible: layer.isVisible,
      settings: layer.settings,
    })),
  };
}

export function buildTechnicalReport(
  input: TechnicalReportInput,
): TechnicalReportViewModel {
  const { data, images } = input;
  const labels = new Map(
    [...data.traces, ...data.referencePrints].map((piece) => [
      piece.id,
      labelOf(piece),
    ]),
  );

  return {
    kind: 'TECHNICAL',
    header: {
      reportId: input.reportId,
      chainHeadSeq: input.chainHead?.seq ?? null,
      chainHeadHash: input.chainHead?.hash ?? null,
      caseNumber: data.investigationCase.caseNumber,
      pvNumber: data.investigationCase.pvNumber,
      caseStatus: data.investigationCase.status,
      openedAt: data.investigationCase.createdAt,
      generatedAt: input.generatedAt,
      generatedByDisplayName: input.generatedByDisplayName,
    },
    caseDescription: data.investigationCase.description,
    traces: data.traces.map((trace) => toPieceViewModel(trace, images)),
    referencePrints: data.referencePrints.map((print) =>
      toPieceViewModel(print, images),
    ),
    comparisons: data.comparisons.map((comparison) => ({
      traceLabel: labels.get(comparison.traceId) ?? comparison.traceId,
      referencePrintLabel:
        labels.get(comparison.referencePrintId) ?? comparison.referencePrintId,
      score: comparison.score,
      machineMatch: comparison.machineMatch,
      declaredHit: comparison.declaredHit,
      comparedAt: comparison.comparedAt,
    })),
  };
}
