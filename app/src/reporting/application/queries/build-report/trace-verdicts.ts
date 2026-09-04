import {
  CaseReportData,
  PieceData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import { positionLabel } from './action-labels';
import { isWithdrawn } from './report-pieces';

export const NOT_APPLICABLE = '/';
export const NEGATIVE_MENTION = 'NÉGATIVE';
export const NOT_EXAMINED_MENTION = 'Non examinée';

export interface TraceVerdict {
  identifiedBy: SubjectData | null;
  identifiedPosition: string | null;
  identified: boolean;
}

export function surname(subject: SubjectData): string {
  return `${subject.lastName.toUpperCase()} ${subject.firstName}`;
}

export function verdictsByTraceId(
  data: CaseReportData,
): Map<string, TraceVerdict> {
  const subjectsById = new Map(
    data.subjects.map((subject) => [subject.id, subject]),
  );
  const referencePrintsById = new Map(
    data.referencePrints.map((print) => [print.id, print]),
  );
  const verdicts = new Map<string, TraceVerdict>();

  for (const hit of data.declaredHits) {
    if (hit.withdrawnAt !== null) {
      continue;
    }
    const referencePrint = referencePrintsById.get(hit.referencePrintId);
    if (!referencePrint || isWithdrawn(referencePrint)) {
      continue;
    }
    const subjectId = referencePrint.subjectId;
    verdicts.set(hit.traceId, {
      identified: true,
      identifiedBy: subjectId ? (subjectsById.get(subjectId) ?? null) : null,
      identifiedPosition: referencePrint.position,
    });
  }
  return verdicts;
}

export function isIdentified(
  trace: PieceData,
  verdicts: Map<string, TraceVerdict>,
): boolean {
  return verdicts.get(trace.id)?.identified === true;
}

export function isDeclaredNegative(
  trace: PieceData,
  verdicts: Map<string, TraceVerdict>,
): boolean {
  return !isIdentified(trace, verdicts) && trace.notIdentifiedAt !== null;
}

export function isNotExamined(
  trace: PieceData,
  verdicts: Map<string, TraceVerdict>,
): boolean {
  return !isIdentified(trace, verdicts) && trace.notIdentifiedAt === null;
}

export function discriminationOf(
  trace: PieceData,
  verdict: TraceVerdict | undefined,
): string {
  if (verdict?.identified) {
    const position = positionLabel(verdict.identifiedPosition);
    const who = verdict.identifiedBy
      ? surname(verdict.identifiedBy)
      : 'personne non renseignée au dossier';
    const where =
      position === null
        ? 'Position non renseignée'
        : position.charAt(0).toUpperCase() + position.slice(1);
    return `${where} — ${who}`;
  }
  if (trace.status !== 'EXPLOITABLE') {
    return NOT_APPLICABLE;
  }
  return trace.notIdentifiedAt === null
    ? NOT_EXAMINED_MENTION
    : NEGATIVE_MENTION;
}
