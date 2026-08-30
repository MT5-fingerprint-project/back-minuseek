import { CaseReportData, PieceData } from '../../ports/case-report-data.reader';

function stillInTheCase(piece: PieceData): boolean {
  return piece.withdrawnAt === null && piece.imageDestroyedAt === null;
}

function identifiedPieceIds(data: CaseReportData): {
  traces: Set<string>;
  prints: Set<string>;
} {
  const traces = new Set<string>();
  const prints = new Set<string>();
  for (const hit of data.declaredHits) {
    if (hit.withdrawnAt !== null) {
      continue;
    }
    traces.add(hit.traceId);
    prints.add(hit.referencePrintId);
  }
  return { traces, prints };
}

export function printedPieces(data: CaseReportData): PieceData[] {
  const identified = identifiedPieceIds(data);

  return [
    ...data.traces.filter(
      (trace) =>
        stillInTheCase(trace) &&
        (trace.status === 'EXPLOITABLE' || identified.traces.has(trace.id)),
    ),
    ...data.referencePrints.filter(
      (print) => stillInTheCase(print) && identified.prints.has(print.id),
    ),
  ];
}


export function printedImagePaths(data: CaseReportData): string[] {
  const identified = identifiedPieceIds(data);
  const locationPhotos = data.traces.flatMap((trace) =>
    stillInTheCase(trace) &&
    identified.traces.has(trace.id) &&
    trace.locationPhoto !== null
      ? [trace.locationPhoto.path]
      : [],
  );

  return [...printedPieces(data).map((piece) => piece.path), ...locationPhotos];
}
