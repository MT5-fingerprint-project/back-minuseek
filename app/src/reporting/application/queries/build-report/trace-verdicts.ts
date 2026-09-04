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

/**
 * Les verdicts d'un dossier portent avec eux ce que le dossier contient : la
 * colonne « Discrimination » n'a de sens qu'au regard des empreintes de
 * familiers versées, et aucune fonction ne peut donc être appelée sans elles.
 */
export interface CaseVerdicts {
  byTraceId: Map<string, TraceVerdict>;
  exclusionPrintCount: number;
  personOfInterestPrintCount: number;
}

export function surname(subject: SubjectData): string {
  return `${subject.lastName.toUpperCase()} ${subject.firstName}`;
}

export function isExclusionSubject(subject: SubjectData | null): boolean {
  return subject !== null && EXCLUSION_SUBJECT_TYPES.has(subject.type);
}

export function caseVerdicts(data: CaseReportData): CaseVerdicts {
  const subjectsById = new Map(
    data.subjects.map((subject) => [subject.id, subject]),
  );
  const subjectOf = (print: PieceData): SubjectData | null =>
    print.subjectId ? (subjectsById.get(print.subjectId) ?? null) : null;

  const verdicts: CaseVerdicts = {
    byTraceId: new Map<string, TraceVerdict>(),
    exclusionPrintCount: 0,
    personOfInterestPrintCount: 0,
  };

  for (const print of data.referencePrints) {
    const subject = subjectOf(print);
    if (isWithdrawn(print) || subject === null) {
      continue;
    }
    if (isExclusionSubject(subject)) {
      verdicts.exclusionPrintCount += 1;
    } else {
      verdicts.personOfInterestPrintCount += 1;
    }
  }

  const referencePrintsById = new Map(
    data.referencePrints.map((print) => [print.id, print]),
  );
  for (const hit of data.declaredHits) {
    if (hit.withdrawnAt !== null) {
      continue;
    }
    const referencePrint = referencePrintsById.get(hit.referencePrintId);
    if (!referencePrint || isWithdrawn(referencePrint)) {
      continue;
    }
    const subject = subjectOf(referencePrint);
    const concordance: TraceConcordance = {
      subject,
      position: referencePrint.position,
    };
    const verdict = verdicts.byTraceId.get(hit.traceId) ?? {
      discrimination: null,
      identification: null,
    };
    if (isExclusionSubject(subject)) {
      verdict.discrimination = concordance;
    } else {
      verdict.identification = concordance;
    }
    verdicts.byTraceId.set(hit.traceId, verdict);
  }
  return verdicts;
}

function verdictOf(
  trace: PieceData,
  verdicts: CaseVerdicts,
): TraceVerdict | undefined {
  return verdicts.byTraceId.get(trace.id);
}

export function identificationOf(
  trace: PieceData,
  verdicts: CaseVerdicts,
): TraceConcordance | null {
  return verdictOf(trace, verdicts)?.identification ?? null;
}

export function isIdentified(
  trace: PieceData,
  verdicts: CaseVerdicts,
): boolean {
  return verdictOf(trace, verdicts)?.identification != null;
}

export function isDiscriminated(
  trace: PieceData,
  verdicts: CaseVerdicts,
): boolean {
  const verdict = verdictOf(trace, verdicts);
  return verdict?.identification == null && verdict?.discrimination != null;
}

export function isDeclaredNegative(
  trace: PieceData,
  verdicts: CaseVerdicts,
): boolean {
  return (
    !isIdentified(trace, verdicts) &&
    !isDiscriminated(trace, verdicts) &&
    trace.notIdentifiedAt !== null
  );
}

export function isNotExamined(
  trace: PieceData,
  verdicts: CaseVerdicts,
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
  verdicts: CaseVerdicts,
): string {
  const discrimination = verdictOf(trace, verdicts)?.discrimination;
  if (discrimination) {
    return concordanceLabel(discrimination);
  }
  if (trace.status !== 'EXPLOITABLE' || verdicts.exclusionPrintCount === 0) {
    return NOT_APPLICABLE;
  }
  // Une trace identifiée a été examinée : la question du familier est tranchée,
  // et l'écrire « Non examinée » démentirait le chapitre des comparaisons.
  return isNotExamined(trace, verdicts) ? NOT_EXAMINED_MENTION : NOT_APPLICABLE;
}

export function comparisonOf(trace: PieceData, verdicts: CaseVerdicts): string {
  const identification = verdictOf(trace, verdicts)?.identification;
  if (identification) {
    return concordanceLabel(identification);
  }
  return trace.notIdentifiedAt === null
    ? NOT_EXAMINED_MENTION
    : NEGATIVE_MENTION;
}
