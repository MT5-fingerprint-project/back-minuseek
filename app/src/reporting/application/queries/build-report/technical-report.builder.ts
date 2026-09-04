import { CaseContributorData } from '../../ports/case-contributors.reader';
import {
  CaseReportData,
  ExpertiseData,
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
  ReportComparisonViewModel,
  ReportExploitabilityViewModel,
  ReportIdentificationViewModel,
  ReportImageViewModel,
  ReportPieceViewModel,
  ReportReferenceSubjectViewModel,
  ReportSaisineViewModel,
  TechnicalReportViewModel,
} from '../../report-view-model';
import {
  civilityLabel,
  positionWithArticle,
  REVELATION_TECHNIQUE_SEQUENCE,
  SYSTEMATIC_REVELATION_TECHNIQUE,
  revelationTechniqueLabel,
  subjectTypeLabel,
  traceOriginLabel,
} from './action-labels';
import { buildAnnexA } from './annex-a';
import { buildAnnexB } from './annex-b';
import { buildCaseHeader } from './case-header';
import { buildLetterhead, signatureCityOf } from './letterhead';
import { buildIntegritySection } from './integrity-section.builder';
import { buildJournalAnnex } from './journal-annex.builder';
import { pieceDesignations } from './piece-designations';
import { buildVerificationAnnexes } from './verification-annex';
import {
  buildDemonstrations,
  isWithdrawn,
  toPieceViewModel,
} from './report-pieces';
import { buildWithdrawnElements } from './withdrawn-elements';
import { groupExaminedTraces, traceReference } from './trace-grouping';
import {
  caseVerdicts,
  CaseVerdicts,
  comparisonOf,
  discriminationOf,
  identificationOf,
  isDeclaredNegative,
  isDiscriminated,
  isIdentified,
  isNotExamined,
  NOT_APPLICABLE,
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
    origin: traceOriginLabel(group.origin) ?? NOT_APPLICABLE,
    location: group.location ?? NOT_APPLICABLE,
    revelationTechnique:
      revelationTechniqueLabel(group.revelationTechnique) ?? NOT_APPLICABLE,
  }));
}

function buildRevelationTechniques(traces: PieceData[]): string[] {
  const employed = new Set<string | null>([
    SYSTEMATIC_REVELATION_TECHNIQUE,
    ...traces.map((trace) => trace.revelationTechnique),
  ]);
  return REVELATION_TECHNIQUE_SEQUENCE.filter((technique) =>
    employed.has(technique),
  );
}

function buildExploitability(
  caseNumber: string,
  traces: PieceData[],
  verdicts: CaseVerdicts,
): ReportExploitabilityViewModel[] {
  return traces.map((trace) => ({
    reference: traceReference(caseNumber, trace.number ?? 0),
    exploitability:
      EXPLOITABILITY_LABELS[trace.status ?? 'RECEIVED'] ?? NOT_APPLICABLE,
    cote: trace.cote ?? NOT_APPLICABLE,
    discrimination: discriminationOf(trace, verdicts),
  }));
}

function buildComparisons(
  caseNumber: string,
  traces: PieceData[],
  verdicts: CaseVerdicts,
): ReportComparisonViewModel[] {
  return traces.map((trace) => ({
    reference: traceReference(caseNumber, trace.number ?? 0),
    cote: trace.cote ?? NOT_APPLICABLE,
    result: comparisonOf(trace, verdicts),
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
  verdicts: CaseVerdicts,
): ReportIdentificationViewModel[] {
  return traces.flatMap((trace) => {
    const identification = identificationOf(trace, verdicts);
    if (!identification || trace.cote === null || isWithdrawn(trace)) {
      return [];
    }
    const subject = identification.subject;
    return [
      {
        cote: trace.cote,
        position: positionWithArticle(identification.position),
        subject:
          subject === null
            ? null
            : {
                civility: civilityLabel(subject.sex),
                firstName: subject.firstName,
                lastName: subject.lastName,
                sex: subject.sex,
                birthDate: subject.birthDate,
                birthPlace: subject.birthPlace,
              },
      },
    ];
  });
}

function buildCounts(
  traces: PieceData[],
  verdicts: CaseVerdicts,
): ReportCountsViewModel {
  const exploitable = traces.filter((trace) => trace.status === 'EXPLOITABLE');
  return {
    total: traces.length,
    exploitable: exploitable.length,
    notExploitable: traces.filter((trace) => trace.status === 'NOT_EXPLOITABLE')
      .length,
    identified: exploitable.filter((trace) => isIdentified(trace, verdicts))
      .length,
    discriminated: exploitable.filter((trace) =>
      isDiscriminated(trace, verdicts),
    ).length,
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

function toSaisine(
  expertise: ExpertiseData | null,
): ReportSaisineViewModel | null {
  if (!expertise) return null;
  return {
    expert: expertise.expert
      ? {
          displayName: `${expertise.expert.firstName} ${expertise.expert.lastName}`,
          grade: expertise.expert.grade,
          serviceNumber: expertise.expert.serviceNumber,
          role: expertise.expert.role,
        }
      : null,
    oathStatement: expertise.oathStatement,
    courtReference: expertise.courtReference,
    swornAt: expertise.swornAt,
    magistrateName: expertise.magistrateName,
    magistrateTitle: expertise.magistrateTitle,
    ordinanceDate: expertise.ordinanceDate,
    missionObject: expertise.missionObject,
    sealCount: expertise.sealCount,
    prorogationDeadline: expertise.prorogationDeadline,
    prorogationOrdinanceDate: expertise.prorogationOrdinanceDate,
    biologicalPrecautions: expertise.biologicalPrecautions,
    assistants: expertise.assistants.map((assistant) => ({ ...assistant })),
  };
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
  const verdicts = caseVerdicts(data);
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
    saisine: toSaisine(data.expertise),
    revelationTechniques: buildRevelationTechniques(orderedTraces),
    previousDocument: input.previousDocument,
    signer: {
      grade: input.signer.grade,
      firstName: input.signer.firstName,
      lastName: input.signer.lastName,
      serviceNumber: input.signer.serviceNumber,
    },
    contributors: buildContributors(input.contributors, input.signer.id),
    withdrawnElements: buildWithdrawnElements(
      orderedTraces,
      data.referencePrints,
      designations,
    ),
    examinedTraces: buildExaminedTraces(caseNumber, workingTraces),
    exploitability: buildExploitability(caseNumber, workingTraces, verdicts),
    referenceSubjects: buildReferenceSubjects(data),
    unattachedReferencePrintCount: data.referencePrints.filter(
      (print) => !isWithdrawn(print) && print.subjectId === null,
    ).length,
    automaticComparatorUsed: data.comparisons.length > 0,
    personOfInterestPrintCount: verdicts.personOfInterestPrintCount,
    comparisons: buildComparisons(caseNumber, exploitableTraces, verdicts),
    identifications: buildIdentifications(workingTraces, verdicts),
    discriminatedCotes: cotesOf(
      exploitableTraces.filter((trace) => isDiscriminated(trace, verdicts)),
    ),
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
    annexA: buildAnnexA(caseNumber, data, images),
    annexB: buildAnnexB(caseNumber, data, images),
    verifications: buildVerificationAnnexes(
      data,
      input.chainEvents,
      designations,
    ),
    integrity: buildIntegritySection({
      traces: workingTraces,
      referencePrints: data.referencePrints.filter(
        (print) => !isWithdrawn(print),
      ),
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
