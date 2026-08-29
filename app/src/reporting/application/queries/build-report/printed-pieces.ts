import { CaseReportData, PieceData } from '../../ports/case-report-data.reader';

function stillInTheCase(piece: PieceData): boolean {
  return piece.withdrawnAt === null && piece.imageDestroyedAt === null;
}

export function printedPieces(data: CaseReportData): PieceData[] {
  const identifiedTraces = new Set<string>();
  const identifiedPrints = new Set<string>();
  for (const hit of data.declaredHits) {
    if (hit.withdrawnAt !== null) {
      continue;
    }
    identifiedTraces.add(hit.traceId);
    identifiedPrints.add(hit.referencePrintId);
  }

  return [
    ...data.traces.filter(
      (trace) =>
        stillInTheCase(trace) &&
        (trace.status === 'EXPLOITABLE' || identifiedTraces.has(trace.id)),
    ),
    ...data.referencePrints.filter(
      (print) => stillInTheCase(print) && identifiedPrints.has(print.id),
    ),
  ];
}
