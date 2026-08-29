import {
  CaseReportData,
  MinutiaData,
} from '../../ports/case-report-data.reader';
import {
  ReportDemonstrationMarkViewModel,
  ReportDemonstrationViewModel,
  ReportImageViewModel,
} from '../../report-view-model';
import { civilityLabel, positionLabel } from './action-labels';
import { isWithdrawn } from './report-pieces';
import { traceReference } from './trace-grouping';

function markOf(
  minutia: MinutiaData | undefined,
  number: number,
): ReportDemonstrationMarkViewModel | null {
  if (!minutia) {
    return null;
  }
  return {
    number,
    x: minutia.x,
    y: minutia.y,
    radius: minutia.radius ?? 6,
    label: minutia.typeLabel,
  };
}

export function buildAnnexB(
  caseNumber: string,
  data: CaseReportData,
  images: Map<string, ReportImageViewModel | null>,
): ReportDemonstrationViewModel[] {
  const tracesById = new Map(data.traces.map((trace) => [trace.id, trace]));
  const printsById = new Map(
    data.referencePrints.map((print) => [print.id, print]),
  );
  const subjectsById = new Map(
    data.subjects.map((subject) => [subject.id, subject]),
  );

  const demonstrations = data.declaredHits.flatMap((hit) => {
    if (hit.withdrawnAt !== null) {
      return [];
    }
    const trace = tracesById.get(hit.traceId);
    const print = printsById.get(hit.referencePrintId);
    if (!trace || !print || isWithdrawn(trace) || isWithdrawn(print)) {
      return [];
    }

    const pairs = data.minutiaPairs.filter(
      (pair) =>
        pair.traceId === hit.traceId &&
        pair.referencePrintId === hit.referencePrintId,
    );
    const traceMarks: ReportDemonstrationMarkViewModel[] = [];
    const printMarks: ReportDemonstrationMarkViewModel[] = [];
    for (const pair of pairs) {
      const number = traceMarks.length + 1;
      const onTrace = markOf(trace.minutiae[pair.traceMinutiaRank - 1], number);
      const onPrint = markOf(
        print.minutiae[pair.referenceMinutiaRank - 1],
        number,
      );
      if (onTrace === null || onPrint === null) {
        continue;
      }
      traceMarks.push(onTrace);
      printMarks.push(onPrint);
    }

    const subject = print.subjectId
      ? subjectsById.get(print.subjectId)
      : undefined;

    const demonstration: ReportDemonstrationViewModel = {
      reference: traceReference(caseNumber, trace.number ?? 0),
      cote: trace.cote ?? '',
      location: trace.location,
      subject: subject
        ? {
            civility: civilityLabel(subject.sex),
            firstName: subject.firstName,
            lastName: subject.lastName,
          }
        : null,
      position: positionLabel(print.position),
      localisationPhoto: null,
      trace: { image: images.get(trace.path) ?? null, marks: traceMarks },
      referencePrint: {
        image: images.get(print.path) ?? null,
        marks: printMarks,
      },
    };

    return [{ rank: trace.number ?? 0, demonstration }];
  });

  return demonstrations
    .sort((left, right) => left.rank - right.rank)
    .map((sortable) => sortable.demonstration);
}
