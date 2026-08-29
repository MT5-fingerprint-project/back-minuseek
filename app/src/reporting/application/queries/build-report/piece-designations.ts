import { CaseReportData, PieceData } from '../../ports/case-report-data.reader';
import { civilityLabel, positionOf } from './action-labels';
import { traceReference } from './trace-grouping';

export interface PieceDesignation {
  full: string;
  bare: string;
}

const UNNAMED_TRACE = 'une trace papillaire';
const UNNAMED_PRINT = 'une empreinte de référence';

function traceDesignation(
  caseNumber: string,
  trace: PieceData,
): PieceDesignation {
  if (trace.number === null) {
    return { full: UNNAMED_TRACE, bare: UNNAMED_TRACE };
  }
  const bare = `la trace ${traceReference(caseNumber, trace.number)}`;
  return {
    full: trace.cote === null ? bare : `${bare} cotée « ${trace.cote} »`,
    bare,
  };
}

function printDesignation(
  print: PieceData,
  subjectNames: Map<string, string>,
): PieceDesignation {
  const finger = positionOf(print.position);
  const person = print.subjectId
    ? (subjectNames.get(print.subjectId) ?? null)
    : null;
  if (finger === null && person === null) {
    return { full: UNNAMED_PRINT, bare: UNNAMED_PRINT };
  }
  const parts = ["l'empreinte", finger, person === null ? null : `de ${person}`]
    .filter((part): part is string => part !== null)
    .join(' ');
  return { full: parts, bare: parts };
}

export function pieceDesignations(
  data: CaseReportData,
): Map<string, PieceDesignation> {
  const caseNumber = data.investigationCase.caseNumber;
  const subjectNames = new Map(
    data.subjects.map((subject) => [
      subject.id,
      `${civilityLabel(subject.sex)} ${subject.lastName.toLocaleUpperCase('fr')} ${subject.firstName}`,
    ]),
  );

  const designations = new Map<string, PieceDesignation>();
  for (const trace of data.traces) {
    designations.set(trace.id, traceDesignation(caseNumber, trace));
  }
  for (const print of data.referencePrints) {
    designations.set(print.id, printDesignation(print, subjectNames));
  }
  return designations;
}

export function designationOf(
  designations: Map<string, PieceDesignation>,
  pieceId: unknown,
  fallback = 'une pièce du dossier',
): PieceDesignation {
  const found =
    typeof pieceId === 'string' ? designations.get(pieceId) : undefined;
  return found ?? { full: fallback, bare: fallback };
}

export const UNNAMED_TRACE_FALLBACK = UNNAMED_TRACE;
export const UNNAMED_PRINT_FALLBACK = UNNAMED_PRINT;
