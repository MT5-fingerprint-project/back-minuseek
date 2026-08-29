import { CaseContributorData } from '../../ports/case-contributors.reader';
import {
  CaseReportData,
  PieceData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import { PreviousDocumentData } from '../../ports/report-numbering.reader';
import { ReportSignerData } from '../../report-signer';
import { ServiceLetterheadData } from '../../ports/service-letterhead.reader';
import { ChainAttestation } from '../../ports/chain-attestation.port';
import {
  AnchorData,
  AuditEventData,
} from '../../ports/traceability-data.reader';
import {
  ReportContributorViewModel,
  JournalDetail,
  ReportCountsViewModel,
  ReportExaminedTraceViewModel,
  ReportExploitabilityViewModel,
  ReportIdentificationViewModel,
  ReportImageViewModel,
  ReportPieceViewModel,
  ReportReferenceSubjectViewModel,
  TechnicalReportViewModel,
} from '../../report-view-model';
import {
  civilityLabel,
  positionWithArticle,
  REVELATION_TECHNIQUE_SEQUENCE,
  revelationTechniqueLabel,
  subjectTypeLabel,
  traceOriginLabel,
} from './action-labels';
import { buildCaseHeader } from './case-header';
import { buildLetterhead, signatureCityOf } from './letterhead';
import { buildIntegritySection } from './integrity-section.builder';
import { buildJournalAnnex } from './journal-annex.builder';
import { pieceDesignations } from './piece-designations';
import {
  buildDemonstrations,
  isWithdrawn,
  toPieceViewModel,
  withdrawalSentence,
} from './report-pieces';
import { groupExaminedTraces, traceReference } from './trace-grouping';
import {
  discriminationOf,
  isDeclaredNegative,
  isIdentified,
  isNotExamined,
  NOT_APPLICABLE,
  TraceVerdict,
  verdictsByTraceId,
} from './trace-verdicts';

export interface TechnicalReportInput {
  data: CaseReportData;
  chainEvents: AuditEventData[];
  anchors: AnchorData[];
  reportId: string;
  reportNumber: string;
  signer: ReportSignerData;
  contributors: CaseContributorData[];
  previousDocument: PreviousDocumentData | null;
  letterhead: ServiceLetterheadData;
  chainHead: { seq: number; hash: string } | null;
  generatedAt: Date;
  generatedByDisplayName: string;
  journalDetail: JournalDetail;
  attestation: ChainAttestation;
  verificationUrl: string;
  images: Map<string, ReportImageViewModel | null>;
}

const NOT_STATED = 'Non renseignée';
const EXPLOITABILITY_LABELS: Record<string, string> = {
  EXPLOITABLE: 'EXPLOITABLE',
  NOT_EXPLOITABLE: 'INEXPLOITABLE',
  RECEIVED: 'Non déclarée',
};

function buildExaminedTraces(
  caseNumber: string,
  traces: PieceData[],
): ReportExaminedTraceViewModel[] {
  return groupExaminedTraces(
    caseNumber,
    traces.map((trace) => ({
      number: trace.number ?? 0,
      origin: trace.origin,
      location: trace.location,
      revelationTechnique: trace.revelationTechnique,
    })),
  ).map((group) => ({
    label: group.label,
    origin: traceOriginLabel(group.origin) ?? NOT_STATED,
    location: group.location ?? NOT_STATED,
    revelationTechnique:
      revelationTechniqueLabel(group.revelationTechnique) ?? NOT_STATED,
  }));
}

function buildRevelationTechniques(traces: PieceData[]): string[] {
  const employed = new Set(traces.map((trace) => trace.revelationTechnique));
  return REVELATION_TECHNIQUE_SEQUENCE.filter((technique) =>
    employed.has(technique),
  );
}

function buildExploitability(
  caseNumber: string,
  traces: PieceData[],
  verdicts: Map<string, TraceVerdict>,
): ReportExploitabilityViewModel[] {
  return traces.map((trace) => ({
    reference: traceReference(caseNumber, trace.number ?? 0),
    exploitability:
      EXPLOITABILITY_LABELS[trace.status ?? 'RECEIVED'] ?? NOT_APPLICABLE,
    cote: trace.cote ?? NOT_APPLICABLE,
    discrimination: isWithdrawn(trace)
      ? NOT_APPLICABLE
      : discriminationOf(trace, verdicts.get(trace.id)),
    withdrawal: withdrawalSentence(trace),
  }));
}

function buildReferenceSubjects(
  data: CaseReportData,
): ReportReferenceSubjectViewModel[] {
  const subjectsById = new Map(
    data.subjects.map((subject) => [subject.id, subject]),
  );
  const attachedIds = new Set(
    data.referencePrints
      .filter((print) => !isWithdrawn(print) && print.subjectId !== null)
      .map((print) => print.subjectId as string),
  );

  return [...attachedIds]
    .map((id) => subjectsById.get(id))
    .filter((subject): subject is SubjectData => subject !== undefined)
    .map((subject) => ({
      civility: civilityLabel(subject.sex),
      firstName: subject.firstName,
      lastName: subject.lastName,
      quality: subjectTypeLabel(subject.type),
    }));
}

function buildIdentifications(
  traces: PieceData[],
  verdicts: Map<string, TraceVerdict>,
): ReportIdentificationViewModel[] {
  return traces.flatMap((trace) => {
    const verdict = verdicts.get(trace.id);
    if (!verdict?.identified || trace.cote === null || isWithdrawn(trace)) {
      return [];
    }
    const subject = verdict.identifiedBy;
    return [
      {
        cote: trace.cote,
        position:
          positionWithArticle(verdict.identifiedPosition) ??
          'à une position non renseignée',
        civility: subject ? civilityLabel(subject.sex) : '',
        firstName: subject?.firstName ?? '',
        lastName: subject?.lastName ?? 'personne non renseignée au dossier',
      },
    ];
  });
}

function buildCounts(
  traces: PieceData[],
  verdicts: Map<string, TraceVerdict>,
): ReportCountsViewModel {
  const exploitable = traces.filter((trace) => trace.status === 'EXPLOITABLE');
  return {
    total: traces.length,
    exploitable: exploitable.length,
    notExploitable: traces.filter((trace) => trace.status === 'NOT_EXPLOITABLE')
      .length,
    identified: exploitable.filter((trace) => isIdentified(trace, verdicts))
      .length,
    negative: exploitable.filter((trace) => isDeclaredNegative(trace, verdicts))
      .length,
    notExamined: exploitable.filter((trace) => isNotExamined(trace, verdicts))
      .length,
  };
}

function cotesOf(traces: PieceData[]): string[] {
  return traces
    .map((trace) => trace.cote)
    .filter((cote): cote is string => cote !== null);
}

function lastAnchorAt(anchors: AnchorData[]): Date | null {
  return anchors.reduce<Date | null>(
    (latest, anchor) =>
      latest === null || anchor.anchoredAt > latest
        ? anchor.anchoredAt
        : latest,
    null,
  );
}

function buildContributors(
  contributors: CaseContributorData[],
  signerUserId: string,
): ReportContributorViewModel[] {
  if (contributors.length === 1 && contributors[0].userId === signerUserId) {
    return [];
  }
  return contributors.map((contributor) => ({
    grade: contributor.grade,
    displayName: contributor.displayName,
  }));
}

export function buildTechnicalReport(
  input: TechnicalReportInput,
): TechnicalReportViewModel {
  const { data, images } = input;
  const caseNumber = data.investigationCase.caseNumber;
  const allPieces = [...data.traces, ...data.referencePrints];
  const pieceViewModels = new Map(
    allPieces.map((piece) => [piece.id, toPieceViewModel(piece, images)]),
  );
  const orderedTraces = [...data.traces].sort(
    (left, right) => (left.number ?? 0) - (right.number ?? 0),
  );
  const workingTraces = orderedTraces.filter((trace) => !isWithdrawn(trace));
  const verdicts = verdictsByTraceId(data);
  const designations = pieceDesignations(data);
  const exploitableTraces = workingTraces.filter(
    (trace) => trace.status === 'EXPLOITABLE',
  );

  return {
    kind: 'TECHNICAL',
    header: {
      reportId: input.reportId,
      reportNumber: input.reportNumber,
      chainHeadSeq: input.chainHead?.seq ?? null,
      chainHeadHash: input.chainHead?.hash ?? null,
      caseNumber,
      pvNumber: data.investigationCase.pvNumber,
      caseStatus: data.investigationCase.status,
      openedAt: data.investigationCase.createdAt,
      generatedAt: input.generatedAt,
      generatedByDisplayName: input.generatedByDisplayName,
      letterhead: buildLetterhead(input.letterhead),
      signatureCity: signatureCityOf(input.letterhead),
    },
    caseHeader: buildCaseHeader(data),
    revelationTechniques: buildRevelationTechniques(orderedTraces),
    previousDocument: input.previousDocument,
    signer: {
      grade: input.signer.grade,
      firstName: input.signer.firstName,
      lastName: input.signer.lastName,
      serviceNumber: input.signer.serviceNumber,
    },
    contributors: buildContributors(input.contributors, input.signer.id),
    examinedTraces: buildExaminedTraces(caseNumber, orderedTraces),
    exploitability: buildExploitability(caseNumber, orderedTraces, verdicts),
    referenceSubjects: buildReferenceSubjects(data),
    unattachedReferencePrintCount: data.referencePrints.filter(
      (print) => !isWithdrawn(print) && print.subjectId === null,
    ).length,
    automaticComparatorUsed: data.comparisons.length > 0,
    identifications: buildIdentifications(workingTraces, verdicts),
    negativeCotes: cotesOf(
      exploitableTraces.filter((trace) => isDeclaredNegative(trace, verdicts)),
    ),
    notExaminedCotes: cotesOf(
      exploitableTraces.filter((trace) => isNotExamined(trace, verdicts)),
    ),
    independentTimestampAt: lastAnchorAt(input.anchors),
    counts: buildCounts(workingTraces, verdicts),
    traces: data.traces.map(
      (trace) => pieceViewModels.get(trace.id) as ReportPieceViewModel,
    ),
    referencePrints: data.referencePrints.map(
      (print) => pieceViewModels.get(print.id) as ReportPieceViewModel,
    ),
    identityDemonstrations: buildDemonstrations(data, pieceViewModels),
    integrity: buildIntegritySection({
      traces: data.traces,
      referencePrints: data.referencePrints,
      designations: designations,
      events: input.chainEvents,
      anchors: input.anchors,
      attestation: input.attestation,
      verificationUrl: input.verificationUrl,
      images,
    }),
    journal: buildJournalAnnex(
      input.chainEvents,
      designations,
      input.journalDetail,
    ),
  };
}
