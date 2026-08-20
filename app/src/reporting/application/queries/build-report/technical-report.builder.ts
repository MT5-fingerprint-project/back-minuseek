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
  /** Familles d'actes non instrumentées, à déclarer telles quelles. */
  notCoveredActions: string[];
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

function payloadReferences(
  payload: Record<string, unknown>,
  traceId: string,
  referencePrintId: string,
): boolean {
  return (
    payload.traceId === traceId && payload.referencePrintId === referencePrintId
  );
}

/**
 * Actes lisibles dans l'état courant mais absents de la chaîne : ils existent en
 * base sans maillon, faute d'instrumentation au moment où ils ont été faits. Les
 * taire rendrait le journal faux ; les mélanger aux maillons rendrait la chaîne
 * plus probante qu'elle ne l'est.
 */
function buildReconstructed(
  data: CaseReportData,
  chainEvents: AuditEventData[],
  pieceLabels: Map<string, string>,
): ReportJournalEntryViewModel[] {
  const chainedComparisons = chainEvents.filter(
    (event) => event.eventType === 'COMPARISON_EXECUTED',
  );
  const chainedHits = chainEvents.filter(
    (event) => event.eventType === 'HIT_RECORDED',
  );

  const comparisons = data.comparisons
    .filter(
      (comparison) =>
        !chainedComparisons.some((event) =>
          payloadReferences(
            event.payload,
            comparison.traceId,
            comparison.referencePrintId,
          ),
        ),
    )
    .map((comparison) => ({
      label: actionLabel('COMPARISON_EXECUTED'),
      detail: `${pieceLabels.get(comparison.traceId) ?? comparison.traceId} contre ${
        pieceLabels.get(comparison.referencePrintId) ??
        comparison.referencePrintId
      }, score ${comparison.score}`,
      occurredAt: comparison.comparedAt,
      actorDisplayName: null,
      seq: null,
      hash: null,
    }));

  const hits = data.declaredHits
    .filter(
      (hit) =>
        !chainedHits.some((event) =>
          payloadReferences(event.payload, hit.traceId, hit.referencePrintId),
        ),
    )
    .map((hit) => ({
      label: actionLabel('HIT_RECORDED'),
      detail: `${pieceLabels.get(hit.traceId) ?? hit.traceId} et ${
        pieceLabels.get(hit.referencePrintId) ?? hit.referencePrintId
      }`,
      occurredAt: hit.declaredAt,
      actorDisplayName: hit.declaredBy
        ? `${hit.declaredBy.firstName} ${hit.declaredBy.lastName}`
        : null,
      seq: null,
      hash: null,
    }));

  return [...comparisons, ...hits].sort(
    (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
  );
}

function buildJournal(
  data: CaseReportData,
  chainEvents: AuditEventData[],
  notCoveredActions: string[],
  pieceLabels: Map<string, string>,
): ReportJournalViewModel {
  return {
    chained: [...chainEvents]
      .sort((left, right) => left.seq - right.seq)
      .map(toChainedEntry),
    reconstructed: buildReconstructed(data, chainEvents, pieceLabels),
    notCovered: notCoveredActions,
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
    journal: buildJournal(
      data,
      input.chainEvents,
      input.notCoveredActions,
      pieceLabels,
    ),
  };
}
