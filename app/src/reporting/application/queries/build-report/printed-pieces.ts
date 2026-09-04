import { CaseReportData, PieceData } from '../../ports/case-report-data.reader';
import { ImageGeometry } from '../../ports/report-image-embedder.port';
import { geometryOf } from './image-treatments';

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

/** Traces de l'annexe de localisation : exploitables, cotées, photographiées. */
export function locatedTraces(data: CaseReportData): PieceData[] {
  return data.traces.filter(
    (trace) =>
      stillInTheCase(trace) &&
      trace.status === 'EXPLOITABLE' &&
      trace.cote !== null &&
      trace.locationPhoto !== null,
  );
}

/**
 * Clé de l'embarquement à l'échelle 1. Une même trace est embarquée deux fois :
 * à sa taille réelle sur la planche de localisation, où c'est sa taille qui est
 * en jeu, et ajustée à la planche en annexe B, où c'est son détail qu'on lit.
 */
export function lifeSizeKey(path: string): string {
  return `${path}@1:1`;
}

/**
 * Clé de la reproduction retravaillée : la même pièce est embarquée telle que
 * scellée pour la planche de constatation, et telle que l'opérateur l'a
 * retournée pour la démonstration.
 */
export function treatedKey(path: string): string {
  return `${path}@atelier`;
}

export interface PrintedImageRequest {
  key: string;
  path: string;
  resolutionDpi: number | null;
  geometry: ImageGeometry | null;
}

export function printedImages(data: CaseReportData): PrintedImageRequest[] {
  const located = locatedTraces(data);
  const fitted = [
    ...printedPieces(data).map((piece) => piece.path),
    ...located.map((trace) => (trace.locationPhoto as { path: string }).path),
  ].map((path) => ({ key: path, path, resolutionDpi: null, geometry: null }));

  // Seules les pièces d'une démonstration sont imprimées retravaillées : rendre les
  // autres coûterait un rééchantillonnage par pièce sans que rien ne s'en serve.
  const demonstrated = identifiedPieceIds(data);
  const treated = printedPieces(data).flatMap((piece) => {
    const shown =
      demonstrated.traces.has(piece.id) || demonstrated.prints.has(piece.id);
    const geometry = shown ? geometryOf(piece) : null;
    return geometry === null
      ? []
      : [
          {
            key: treatedKey(piece.path),
            path: piece.path,
            resolutionDpi: null,
            geometry,
          },
        ];
  });

  const lifeSize = located.flatMap((trace) =>
    trace.resolutionDpi === null
      ? []
      : [
          {
            key: lifeSizeKey(trace.path),
            path: trace.path,
            resolutionDpi: trace.resolutionDpi,
            geometry: null,
          },
        ],
  );

  return [...fitted, ...treated, ...lifeSize];
}
