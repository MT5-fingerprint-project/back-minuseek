import { PieceData } from '../../ports/case-report-data.reader';
import {
  ReportImageViewModel,
  ReportPlateViewModel,
} from '../../report-view-model';
import { isWithdrawn } from './report-pieces';
import { traceReference } from './trace-grouping';

export function buildAnnexA(
  caseNumber: string,
  traces: PieceData[],
  images: Map<string, ReportImageViewModel | null>,
): ReportPlateViewModel[] {
  return traces
    .filter(
      (trace) =>
        !isWithdrawn(trace) &&
        trace.status === 'EXPLOITABLE' &&
        trace.cote !== null,
    )
    .map((trace) => ({
      reference: traceReference(caseNumber, trace.number ?? 0),
      cote: trace.cote as string,
      location: trace.location,
      image: images.get(trace.path) ?? null,
      sealedAt: trace.createdAt,
    }));
}
