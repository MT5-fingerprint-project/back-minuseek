export interface ReportLetterheadViewModel {
  administration: string | null;
  serviceName: string | null;
  postalAddress: string | null;
  phoneNumber: string | null;
  email: string | null;
}

export interface ReportHeaderViewModel {
  reportId: string;
  reportNumber: string;
  chainHeadSeq: number | null;
  chainHeadHash: string | null;
  caseNumber: string;
  pvNumber: string;
  caseStatus: string;
  openedAt: Date;
  generatedAt: Date;
  generatedByDisplayName: string;
  letterhead: ReportLetterheadViewModel | null;
  signatureCity: string | null;
}

export interface ReportRecipientViewModel {
  authority: string;
  attention: string | null;
}

export interface ReportCaseHeaderViewModel {
  caseNumber: string;
  pvNumber: string;
  requestDate: Date | null;
  requesterQuality: string | null;
  requesterName: string | null;
  requesterService: string | null;
  offenseNature: string | null;
  offenseLocation: string | null;
  offenseDateFrom: Date | null;
  offenseDateTo: Date | null;
  interventionDate: Date | null;
  caseAgainst: string | null;
  victims: string[];
  recipient: ReportRecipientViewModel | null;
}

export interface ReportImageViewModel {
  dataUrl: string;
  width: number | null;
  height: number | null;
}

export interface ReportMinutiaViewModel {
  index: number;
  x: number;
  y: number;
  radius: number;
  angleDeg: number | null;
  color: string;
}

export interface ReportWithdrawalViewModel {
  at: Date;
  motiveLabel: string;
}

export interface ReportPieceViewModel {
  label: string;
  sha256: string | null;
  receivedAt: Date;
  capturedAt: Date | null;
  status: string | null;
  image: ReportImageViewModel | null;
  minutiae: ReportMinutiaViewModel[];
  layers: ReportLayerViewModel[];
  withdrawal: ReportWithdrawalViewModel | null;
  imageDestroyedAt: Date | null;
}

export interface ReportSubjectViewModel {
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  birthPlace: string | null;
  sex: string;
  type: string;
}

export interface ReportExpertViewModel {
  displayName: string;
  grade: string;
  serviceNumber: string;
  role: string;
}

export interface ReportIdentityDemonstrationViewModel {
  trace: ReportPieceViewModel;
  referencePrint: ReportPieceViewModel;
  subject: ReportSubjectViewModel | null;
  position: string | null;
  comparedAt: Date | null;
  declaredAt: Date;
  declaredBy: ReportExpertViewModel | null;
  requiredMinutiae: number;
}

export interface ReportExaminedTraceViewModel {
  label: string;
  origin: string;
  location: string;
  revelationTechnique: string;
}

export interface ReportExploitabilityViewModel {
  reference: string;
  exploitability: string;
  cote: string;
  discrimination: string;
  withdrawal: string | null;
}

export interface ReportReferenceSubjectViewModel {
  civility: string;
  firstName: string;
  lastName: string;
  quality: string;
}

export interface ReportIdentificationViewModel {
  cote: string;
  position: string;
  civility: string;
  firstName: string;
  lastName: string;
}

export interface ReportImageTreatmentViewModel {
  reference: string;
  cote: string;
  sealedAt: Date;
  treatments: string;
}

export interface ReportSignerViewModel {
  grade: string;
  firstName: string;
  lastName: string;
  serviceNumber: string;
}

export interface ReportContributorViewModel {
  grade: string | null;
  displayName: string;
}

export interface ReportPreviousDocumentViewModel {
  number: string;
  issuedAt: Date;
}

export interface ReportCountsViewModel {
  total: number;
  exploitable: number;
  notExploitable: number;
  identified: number;
  negative: number;
  notExamined: number;
}

export type JournalDetail = 'SUMMARY' | 'FULL';

export interface ReportJournalActViewModel {
  order: number;
  occurredAt: Date;
  actorDisplayName: string;
  sentence: string;
}

export interface ReportJournalSummaryViewModel {
  family: 'ADJUSTMENT' | 'MARK';
  pieceDesignation: string;
  count: number;
  firstAt: Date;
  lastAt: Date;
}

export interface ReportJournalViewModel {
  detail: JournalDetail;
  acts: ReportJournalActViewModel[];
  summaries: ReportJournalSummaryViewModel[];
  actCountTotal: number;
  actCountPrinted: number;
}

export interface ReportLayerViewModel {
  name: string;
  type: string;
  zIndex: number;
  isVisible: boolean;
  settings: Record<string, unknown>;
}

export interface TechnicalReportViewModel {
  kind: 'TECHNICAL';
  header: ReportHeaderViewModel;
  caseHeader: ReportCaseHeaderViewModel;
  revelationTechniques: string[];
  previousDocument: ReportPreviousDocumentViewModel | null;
  signer: ReportSignerViewModel;
  contributors: ReportContributorViewModel[];
  examinedTraces: ReportExaminedTraceViewModel[];
  exploitability: ReportExploitabilityViewModel[];
  referenceSubjects: ReportReferenceSubjectViewModel[];
  unattachedReferencePrintCount: number;
  automaticComparatorUsed: boolean;
  identifications: ReportIdentificationViewModel[];
  negativeCotes: string[];
  notExaminedCotes: string[];
  imageTreatments: ReportImageTreatmentViewModel[];
  independentTimestampAt: Date | null;
  counts: ReportCountsViewModel;
  traces: ReportPieceViewModel[];
  referencePrints: ReportPieceViewModel[];
  identityDemonstrations: ReportIdentityDemonstrationViewModel[];
  journal: ReportJournalViewModel;
}

export interface TraceabilityEventViewModel {
  seq: number;
  eventType: string;
  evidenceClass: string;
  actorDisplayName: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  hash: string;
  prevHash: string;
}

export interface TraceabilityAnchorViewModel {
  headSeq: number;
  headHash: string;
  tsaUrl: string;
  anchoredAt: Date;
  tsrSha256: string;
}

export interface TraceabilityReportViewModel {
  kind: 'TRACEABILITY';
  header: ReportHeaderViewModel;
  events: TraceabilityEventViewModel[];
  hashSpine: { seq: number; hash: string }[];
  anchors: TraceabilityAnchorViewModel[];
  attestation: {
    ok: boolean;
    eventsChecked: number;
    firstBrokenSeq: number | null;
    anchorsVerified: number;
    anchorsFailed: number;
  };
}

export type ReportViewModel =
  | TechnicalReportViewModel
  | TraceabilityReportViewModel;
