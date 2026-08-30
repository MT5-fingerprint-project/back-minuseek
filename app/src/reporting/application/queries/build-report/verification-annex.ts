import {
  CaseReportData,
  VerificationReportData,
} from '../../ports/case-report-data.reader';
import { AuditEventData } from '../../ports/traceability-data.reader';
import {
  ReportJournalActViewModel,
  ReportVerificationActGroupViewModel,
  ReportVerificationViewModel,
} from '../../report-view-model';
import {
  verificationResultLabel,
  verificationVerdictLabel,
} from './action-labels';
import { Designations, journalSentence } from './journal-sentences';
import { designationOf, UNNAMED_TRACE_FALLBACK } from './piece-designations';

const OUTSIDE_PIECE_DESIGNATION = 'le dossier';

function actGroupsOf(
  verification: VerificationReportData,
  chainEvents: AuditEventData[],
  designations: Designations,
  until: Date | null,
): ReportVerificationActGroupViewModel[] {
  const identityProviderId = verification.verifier?.identityProviderId;
  if (identityProviderId === undefined) {
    return [];
  }

  const groups = new Map<string, ReportJournalActViewModel[]>();
  const ownActs = chainEvents
    .filter(
      (event) =>
        event.actorSub === identityProviderId &&
        event.occurredAt.getTime() >= verification.requestedAt.getTime() &&
        (until === null || event.occurredAt.getTime() < until.getTime()),
    )
    .sort((left, right) => left.seq - right.seq);

  for (const act of ownActs) {
    const designation =
      act.traceId === null
        ? OUTSIDE_PIECE_DESIGNATION
        : designationOf(designations, act.traceId, UNNAMED_TRACE_FALLBACK).full;
    const acts = groups.get(designation) ?? [];
    acts.push({
      order: acts.length + 1,
      occurredAt: act.occurredAt,
      actorDisplayName: act.actorDisplayName,
      sentence: journalSentence(act, designations),
    });
    groups.set(designation, acts);
  }

  return [...groups.entries()].map(([pieceDesignation, acts]) => ({
    pieceDesignation,
    acts,
  }));
}

function confrontedTraces(
  data: CaseReportData,
  verification: VerificationReportData,
) {
  return data.traces.filter(
    (trace) =>
      trace.withdrawnAt === null ||
      verification.decisions.some((decision) => decision.traceId === trace.id),
  );
}

function nextMissionOf(
  verification: VerificationReportData,
  all: VerificationReportData[],
): Date | null {
  const later = all
    .filter(
      (candidate) =>
        candidate.verifier?.identityProviderId ===
          verification.verifier?.identityProviderId &&
        candidate.requestedAt.getTime() > verification.requestedAt.getTime(),
    )
    .map((candidate) => candidate.requestedAt)
    .sort((left, right) => left.getTime() - right.getTime());
  return later[0] ?? null;
}

export function buildVerificationAnnexes(
  data: CaseReportData,
  chainEvents: AuditEventData[],
  designations: Designations,
): ReportVerificationViewModel[] {
  return data.verifications
    .filter(
      (
        verification,
      ): verification is VerificationReportData & { completedAt: Date } =>
        verification.completedAt !== null,
    )
    .sort(
      (left, right) => left.completedAt.getTime() - right.completedAt.getTime(),
    )
    .map((verification) => ({
      verifier: verification.verifier
        ? {
            displayName: `${verification.verifier.firstName} ${verification.verifier.lastName}`,
            grade: verification.verifier.grade,
            serviceNumber: verification.verifier.serviceNumber,
            role: verification.verifier.role,
          }
        : null,
      requestedAt: verification.requestedAt,
      completedAt: verification.completedAt,
      verdictLabel: verificationVerdictLabel(verification.status),
      traces: confrontedTraces(data, verification).map((trace) => ({
        traceDesignation: designationOf(
          designations,
          trace.id,
          UNNAMED_TRACE_FALLBACK,
        ).full,
        resultLabel: verificationResultLabel(
          verification.decisions.find(
            (decision) => decision.traceId === trace.id,
          )?.outcome ?? null,
        ),
      })),
      actGroups: actGroupsOf(
        verification,
        chainEvents,
        designations,
        nextMissionOf(verification, data.verifications),
      ),
    }));
}
