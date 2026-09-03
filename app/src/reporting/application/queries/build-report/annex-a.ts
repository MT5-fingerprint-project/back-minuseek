import { CaseReportData } from '../../ports/case-report-data.reader';
import {
  ReportImageViewModel,
  ReportPlateViewModel,
} from '../../report-view-model';
import { lifeSizeKey, locatedTraces } from './printed-pieces';
import { traceReference } from './trace-grouping';

export function buildAnnexA(
  caseNumber: string,
  data: CaseReportData,
  images: Map<string, ReportImageViewModel | null>,
): ReportPlateViewModel[] {
  return locatedTraces(data).map((trace) => ({
    reference: traceReference(caseNumber, trace.number ?? 0),
    cote: trace.cote as string,
    location: trace.location,
    locationPhoto:
      images.get((trace.locationPhoto as { path: string }).path) ?? null,
    trace: images.get(lifeSizeKey(trace.path)) ?? null,
    sealedAt: trace.createdAt,
  }));
}
