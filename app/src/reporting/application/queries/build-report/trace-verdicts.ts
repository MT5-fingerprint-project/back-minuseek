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

/** La victime est une personne familière des lieux : sa trace écarte, elle n'accuse pas. */
const EXCLUSION_SUBJECT_TYPES = new Set(['CLOSE_ASSOCIATE', 'VICTIM']);

export interface TraceConcordance {
  subject: SubjectData | null;
  position: string | null;
}

export interface TraceVerdict {
  discrimination: TraceConcordance | null;
  identification: TraceConcordance | null;
}

export function surname(subject: SubjectData): string {
  return `${subject.lastName.toUpperCase()} ${subject.firstName}`;
}

export function isExclusionSubject(subject: SubjectData | null): boolean {
  return subject !== null && EXCLUSION_SUBJECT_TYPES.has(subject.type);
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
    const subject = subjectId ? (subjectsById.get(subjectId) ?? null) : null;
    const concordance: TraceConcordance = {
      subject,
      position: referencePrint.position,
    };
    const verdict = verdicts.get(hit.traceId) ?? {
      discrimination: null,
      identification: null,
    };
    if (isExclusionSubject(subject)) {
      verdict.discrimination = concordance;
    } else {
      verdict.identification = concordance;
    }
    verdicts.set(hit.traceId, verdict);
  }
  return verdicts;
}

export function isIdentified(
  trace: PieceData,
  verdicts: Map<string, TraceVerdict>,
): boolean {
  return verdicts.get(trace.id)?.identification != null;
}

export function isDiscriminated(
  trace: PieceData,
  verdicts: Map<string, TraceVerdict>,
): boolean {
  const verdict = verdicts.get(trace.id);
  return verdict?.identification == null && verdict?.discrimination != null;
}

export function isDeclaredNegative(
  trace: PieceData,
  verdicts: Map<string, TraceVerdict>,
): boolean {
  return (
    !isIdentified(trace, verdicts) &&
    !isDiscriminated(trace, verdicts) &&
    trace.notIdentifiedAt !== null
  );
}

export function isNotExamined(
  trace: PieceData,
  verdicts: Map<string, TraceVerdict>,
): boolean {
  return (
    !isIdentified(trace, verdicts) &&
    !isDiscriminated(trace, verdicts) &&
    trace.notIdentifiedAt === null
  );
}

function concordanceLabel(concordance: TraceConcordance): string {
  const position = positionLabel(concordance.position);
  const stated = [
    position === null
      ? null
      : position.charAt(0).toUpperCase() + position.slice(1),
    concordance.subject === null ? null : surname(concordance.subject),
  ].filter((part): part is string => part !== null);
  return stated.length === 0 ? NOT_APPLICABLE : stated.join(' — ');
}

export function discriminationOf(
  trace: PieceData,
  verdict: TraceVerdict | undefined,
  caseHoldsExclusionPrints: boolean,
): string {
  if (verdict?.discrimination) {
    return concordanceLabel(verdict.discrimination);
  }
  if (trace.status !== 'EXPLOITABLE' || !caseHoldsExclusionPrints) {
    return NOT_APPLICABLE;
  }
  return trace.notIdentifiedAt === null ? NOT_EXAMINED_MENTION : NOT_APPLICABLE;
}

export function comparisonOf(
  trace: PieceData,
  verdict: TraceVerdict | undefined,
): string {
  if (verdict?.identification) {
    return concordanceLabel(verdict.identification);
  }
  return trace.notIdentifiedAt === null
    ? NOT_EXAMINED_MENTION
    : NEGATIVE_MENTION;
}
