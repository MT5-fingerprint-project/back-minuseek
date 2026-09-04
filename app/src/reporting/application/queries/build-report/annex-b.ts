import {
  CaseReportData,
  MinutiaData,
  PieceData,
} from '../../ports/case-report-data.reader';
import {
  ReportDemonstrationMarkViewModel,
  ReportDemonstrationViewModel,
  ReportImageViewModel,
} from '../../report-view-model';
import { ImageGeometry } from '../../ports/report-image-embedder.port';
import { civilityLabel, positionLabel } from './action-labels';
import { geometryOf, movedByGeometry } from './image-treatments';
import { treatedKey } from './printed-pieces';
import { isWithdrawn } from './report-pieces';
import { isExclusionSubject } from './trace-verdicts';
import { traceReference } from './trace-grouping';

type Move = (point: { x: number; y: number }) => { x: number; y: number };

function markOf(
  minutia: MinutiaData | undefined,
  number: number,
  move: Move,
): ReportDemonstrationMarkViewModel | null {
  if (!minutia) {
    return null;
  }
  const { x, y } = move({ x: minutia.x, y: minutia.y });
  return {
    number,
    x,
    y,
    radius: minutia.radius ?? 6,
    label: minutia.typeLabel,
  };
}

const STILL: Move = (point) => point;

interface PrintedPiece {
  image: ReportImageViewModel | null;
  sealed: ReportImageViewModel | null;
  move: Move;
}

function measured(
  image: ReportImageViewModel | null,
): { width: number; height: number } | null {
  return image === null || image.width === null || image.height === null
    ? null
    : { width: image.width, height: image.height };
}

/**
 * Reproduction sur laquelle la démonstration s'appuie : celle que l'opérateur a
 * retournée dans le comparateur, avec les minuties déplacées d'autant. Faute de
 * dimensions des deux côtés, on s'en tient à la pièce scellée : une planche
 * retournée dont les repères ne suivent pas ne démontrerait rien.
 */
function printedPiece(
  piece: PieceData,
  images: Map<string, ReportImageViewModel | null>,
): PrintedPiece {
  const sealed = images.get(piece.path) ?? null;
  const geometry: ImageGeometry | null = geometryOf(piece);
  const treated =
    geometry === null ? null : (images.get(treatedKey(piece.path)) ?? null);
  const source = measured(sealed);
  const printed = measured(treated);

  if (
    geometry === null ||
    treated === null ||
    source === null ||
    printed === null
  ) {
    return { image: sealed, sealed: null, move: STILL };
  }
  return {
    image: treated,
    sealed,
    move: (point) => movedByGeometry(point, geometry, source, printed),
  };
}

function byId(minutiae: MinutiaData[]): Map<string, MinutiaData> {
  return new Map(minutiae.map((minutia) => [minutia.id, minutia]));
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

    const subject = print.subjectId
      ? subjectsById.get(print.subjectId)
      : undefined;
    if (isExclusionSubject(subject ?? null)) {
      return [];
    }

    const pairs = data.minutiaPairs.filter(
      (pair) =>
        pair.traceId === hit.traceId &&
        pair.referencePrintId === hit.referencePrintId,
    );
    const printedTrace = printedPiece(trace, images);
    const printedReference = printedPiece(print, images);
    const traceMinutiae = byId(trace.minutiae);
    const printMinutiae = byId(print.minutiae);
    const traceMarks: ReportDemonstrationMarkViewModel[] = [];
    const printMarks: ReportDemonstrationMarkViewModel[] = [];
    for (const pair of pairs) {
      const onTrace = markOf(
        traceMinutiae.get(pair.traceMinutiaLayerId),
        pair.number,
        printedTrace.move,
      );
      const onPrint = markOf(
        printMinutiae.get(pair.referenceMinutiaLayerId),
        pair.number,
        printedReference.move,
      );
      if (onTrace === null || onPrint === null) {
        continue;
      }
      traceMarks.push(onTrace);
      printMarks.push(onPrint);
    }

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
      rawTrace: printedTrace.sealed,
      trace: { image: printedTrace.image, marks: traceMarks },
      referencePrint: {
        image: printedReference.image,
        marks: printMarks,
      },
    };

    return [{ rank: trace.number ?? 0, demonstration }];
  });

  return demonstrations
    .sort((left, right) => left.rank - right.rank)
    .map((sortable) => sortable.demonstration);
}
