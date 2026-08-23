import { REQUIRED_MINUTIAE } from '../../../../shared/domain/forensics/minutiae';
import {
  CaseReportData,
  ComparisonData,
  DeclaredHitData,
  PieceData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import { AuditEventData } from '../../ports/traceability-data.reader';
import {
  ReportIdentityDemonstrationViewModel,
  ReportImageViewModel,
  ReportJournalEntryViewModel,
  ReportJournalViewModel,
  ReportPieceViewModel,
  TechnicalReportViewModel,
} from '../../report-view-model';
import { actionLabel, describeAction, positionLabel } from './action-labels';

export interface TechnicalReportInput {
  data: CaseReportData;
  /** Maillons du dossier, pour le journal des actes. */
  chainEvents: AuditEventData[];
  reportId: string;
  chainHead: { seq: number; hash: string } | null;
  generatedAt: Date;
  generatedByDisplayName: string;
  images: Map<string, ReportImageViewModel | null>;
}

function labelOf(piece: PieceData): string {
  const fileName = piece.path.slice(piece.path.lastIndexOf('/') + 1);
  return fileName.length > 0 ? fileName : piece.id;
}

function toPieceViewModel(
  piece: PieceData,
  images: Map<string, ReportImageViewModel | null>,
): ReportPieceViewModel {
  return {
    label: labelOf(piece),
    sha256: piece.sha256,
    receivedAt: piece.createdAt,
    capturedAt: piece.capturedAt,
    status: piece.status,
    exploitabilityScore: piece.score,
    image: images.get(piece.path) ?? null,
    minutiae: piece.minutiae.map((minutia, order) => ({
      index: order + 1,
      x: minutia.x,
      y: minutia.y,
      radius: minutia.radius ?? 6,
      angleDeg: minutia.angleDeg,
      color: minutia.color ?? '#d92b2b',
    })),
    layers: piece.layers.map((layer) => ({
      name: layer.name,
      type: layer.type,
      zIndex: layer.zIndex,
      isVisible: layer.isVisible,
      settings: layer.settings,
    })),
  };
}

function toSubjectViewModel(subject: SubjectData) {
  return {
    firstName: subject.firstName,
    lastName: subject.lastName,
    birthDate: subject.birthDate,
    birthPlace: subject.birthPlace,
    sex: subject.sex,
    type: subject.type,
  };
}

function buildDemonstrations(
  data: CaseReportData,
  pieces: Map<string, ReportPieceViewModel>,
): ReportIdentityDemonstrationViewModel[] {
  const comparisonByPair = new Map<string, ComparisonData>(
    data.comparisons.map((comparison) => [
      `${comparison.traceId}:${comparison.referencePrintId}`,
      comparison,
    ]),
  );
  const subjectsById = new Map(
    data.subjects.map((subject) => [subject.id, subject]),
  );
  const referencePrintsById = new Map(
    data.referencePrints.map((print) => [print.id, print]),
  );

  return data.declaredHits.flatMap((hit: DeclaredHitData) => {
    const trace = pieces.get(hit.traceId);
    const referencePrint = pieces.get(hit.referencePrintId);
    if (!trace || !referencePrint) {
      return [];
    }
    const subjectId = referencePrintsById.get(hit.referencePrintId)?.subjectId;
    const subject = subjectId ? subjectsById.get(subjectId) : undefined;
    const comparison = comparisonByPair.get(
      `${hit.traceId}:${hit.referencePrintId}`,
    );

    return [
      {
        trace,
        referencePrint,
        subject: subject ? toSubjectViewModel(subject) : null,
        position: positionLabel(
          referencePrintsById.get(hit.referencePrintId)?.position ?? null,
        ),
        score: comparison?.score ?? null,
        machineMatch: comparison?.machineMatch ?? null,
        comparedAt: comparison?.comparedAt ?? null,
        declaredAt: hit.declaredAt,
        declaredBy: hit.declaredBy
          ? {
              displayName: `${hit.declaredBy.firstName} ${hit.declaredBy.lastName}`,
              grade: hit.declaredBy.grade,
              serviceNumber: hit.declaredBy.serviceNumber,
              role: hit.declaredBy.role,
            }
          : null,
        requiredMinutiae: REQUIRED_MINUTIAE,
      },
    ];
  });
}

function toChainedEntry(event: AuditEventData): ReportJournalEntryViewModel {
  return {
    label: actionLabel(event.eventType),
    detail: describeAction(event.eventType, event.payload),
    occurredAt: event.occurredAt,
    actorDisplayName: event.actorDisplayName,
    seq: event.seq,
    hash: event.hash,
  };
}

function buildJournal(chainEvents: AuditEventData[]): ReportJournalViewModel {
  return {
    chained: [...chainEvents]
      .sort((left, right) => left.seq - right.seq)
      .map(toChainedEntry),
  };
}

export function buildTechnicalReport(
  input: TechnicalReportInput,
): TechnicalReportViewModel {
  const { data, images } = input;
  const allPieces = [...data.traces, ...data.referencePrints];
  const pieceViewModels = new Map(
    allPieces.map((piece) => [piece.id, toPieceViewModel(piece, images)]),
  );
  const pieceLabels = new Map(
    allPieces.map((piece) => [piece.id, labelOf(piece)]),
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
    traces: data.traces.map(
      (trace) => pieceViewModels.get(trace.id) as ReportPieceViewModel,
    ),
    referencePrints: data.referencePrints.map(
      (print) => pieceViewModels.get(print.id) as ReportPieceViewModel,
    ),
    comparisons: data.comparisons.map((comparison) => ({
      traceLabel: pieceLabels.get(comparison.traceId) ?? comparison.traceId,
      referencePrintLabel:
        pieceLabels.get(comparison.referencePrintId) ??
        comparison.referencePrintId,
      score: comparison.score,
      machineMatch: comparison.machineMatch,
      declaredHit: comparison.declaredHit,
      comparedAt: comparison.comparedAt,
    })),
    identityDemonstrations: buildDemonstrations(data, pieceViewModels),
    journal: buildJournal(input.chainEvents),
  };
}
