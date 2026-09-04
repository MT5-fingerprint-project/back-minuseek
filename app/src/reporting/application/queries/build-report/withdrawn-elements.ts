import { PieceData } from '../../ports/case-report-data.reader';
import { ReportWithdrawnElementViewModel } from '../../report-view-model';
import { withdrawalMotiveLabel } from './action-labels';
import { designationOf, PieceDesignation } from './piece-designations';
import { NOT_APPLICABLE } from './trace-verdicts';

function withdrawnElementOf(
  piece: PieceData,
  designations: Map<string, PieceDesignation>,
): ReportWithdrawnElementViewModel | null {
  if (piece.withdrawnAt === null) {
    return null;
  }
  return {
    designation: designationOf(designations, piece.id).full,
    withdrawnAt: piece.withdrawnAt,
    motiveLabel:
      piece.withdrawalMotive === null
        ? NOT_APPLICABLE
        : withdrawalMotiveLabel(
            piece.withdrawalMotive,
            piece.withdrawalMotiveDetail,
          ),
    imageDestroyed: piece.imageDestroyedAt !== null,
  };
}

export function buildWithdrawnElements(
  traces: PieceData[],
  referencePrints: PieceData[],
  designations: Map<string, PieceDesignation>,
): ReportWithdrawnElementViewModel[] {
  return [...traces, ...referencePrints]
    .map((piece) => withdrawnElementOf(piece, designations))
    .filter(
      (element): element is ReportWithdrawnElementViewModel => element !== null,
    );
}
