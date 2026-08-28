import { REQUIRED_MINUTIAE } from '../../../../shared/domain/forensics/minutiae';
import {
  CaseReportData,
  ComparisonData,
  DeclaredHitData,
  PieceData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import {
  ReportIdentityDemonstrationViewModel,
  ReportImageViewModel,
  ReportPieceViewModel,
  ReportSubjectViewModel,
  ReportWithdrawalViewModel,
} from '../../report-view-model';
import { formatLongDay } from '../../report-dates';
import { positionLabel, withdrawalMotiveLabel } from './action-labels';

function labelOf(piece: PieceData): string {
  const fileName = piece.path.slice(piece.path.lastIndexOf('/') + 1);
  return fileName.length > 0 ? fileName : piece.id;
}

export function isWithdrawn(piece: PieceData): boolean {
  return piece.withdrawnAt !== null;
}

function withdrawalOf(piece: PieceData): ReportWithdrawalViewModel | null {
  return piece.withdrawnAt === null || piece.withdrawalMotive === null
    ? null
    : {
        at: piece.withdrawnAt,
        motiveLabel: withdrawalMotiveLabel(piece.withdrawalMotive),
      };
}

export function withdrawalSentence(piece: PieceData): string | null {
  const withdrawal = withdrawalOf(piece);
  return withdrawal === null
    ? null
    : `Retirée du dossier le ${formatLongDay(withdrawal.at)} — ${withdrawal.motiveLabel}`;
}

export function toPieceViewModel(
  piece: PieceData,
  images: Map<string, ReportImageViewModel | null>,
): ReportPieceViewModel {
  return {
    label: labelOf(piece),
    sha256: piece.sha256,
    receivedAt: piece.createdAt,
    capturedAt: piece.capturedAt,
    status: piece.status,
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
    withdrawal: withdrawalOf(piece),
    imageDestroyedAt: piece.imageDestroyedAt,
  };
}

function toSubjectViewModel(subject: SubjectData): ReportSubjectViewModel {
  return {
    firstName: subject.firstName,
    lastName: subject.lastName,
    birthDate: subject.birthDate,
    birthPlace: subject.birthPlace,
    sex: subject.sex,
    type: subject.type,
  };
}

export function buildDemonstrations(
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
    if (
      hit.withdrawnAt !== null ||
      trace.withdrawal ||
      referencePrint.withdrawal
    ) {
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
