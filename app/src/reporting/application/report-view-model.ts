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
  observedSha256: string | null;
  /**
   * Taille d'impression imposée à la planche, en millimètres, quand la pièce
   * s'imprime à l'échelle 1. `null` : la planche l'ajuste à sa boîte.
   */
  lifeSizeMm: { width: number; height: number } | null;
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

export interface ReportPlateViewModel {
  reference: string;
  cote: string;
  location: string | null;
  locationPhoto: ReportImageViewModel | null;
  /** Trace à l'échelle 1 ; `null` quand aucune échelle n'est établie. */
  trace: ReportImageViewModel | null;
  sealedAt: Date;
}

export interface ReportDemonstrationMarkViewModel {
  number: number;
  x: number;
  y: number;
  radius: number;
  label: string | null;
}

export interface ReportDemonstrationPlateViewModel {
  image: ReportImageViewModel | null;
  marks: ReportDemonstrationMarkViewModel[];
}

export interface ReportDemonstrationViewModel {
  reference: string;
  cote: string;
  location: string | null;
  subject: {
    civility: string;
    firstName: string;
    lastName: string;
  } | null;
  position: string | null;
  trace: ReportDemonstrationPlateViewModel;
  referencePrint: ReportDemonstrationPlateViewModel;
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

export interface ReportTreatmentViewModel {
  sentence: string;
  appliedAt: Date;
  actorDisplayName: string;
  removedAt: Date | null;
  hiddenAtEdition: boolean;
}

export interface ReportPieceIntegrityViewModel {
  designation: string;
  cote: string | null;
  recordedSha256: string | null;
  sealedAt: Date | null;
  recordEntryNumber: number | null;
  currentRowSha256: string | null;
  divergesFromRecord: boolean;
  servedFileIsDerived: boolean;
  observedSha256: string | null;
  observedMatchesRecord: boolean | null;
  treatments: ReportTreatmentViewModel[];
  lastActEntryNumber: number | null;
  coveringAnchor: {
    anchoredAt: Date;
    authority: string;
    entryNumber: number;
  } | null;
}

export interface ReportIntegrityViewModel {
  traces: ReportPieceIntegrityViewModel[];
  referencePrints: ReportPieceIntegrityViewModel[];
  lastAnchor: { anchoredAt: Date; entryNumber: number } | null;
  recordVerifiedAtEdition: boolean;
  firstBrokenEntryNumber: number | null;
  anchorsFailed: number;
  verificationUrl: string;
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

export interface ReportVerificationTraceViewModel {
  traceDesignation: string;
  resultLabel: string;
}

export interface ReportVerificationActGroupViewModel {
  pieceDesignation: string;
  acts: ReportJournalActViewModel[];
}

export interface ReportVerificationViewModel {
  verifier: ReportExpertViewModel | null;
  requestedAt: Date;
  completedAt: Date;
  verdictLabel: string;
  traces: ReportVerificationTraceViewModel[];
  actGroups: ReportVerificationActGroupViewModel[];
}

export interface ReportLayerViewModel {
  name: string;
  type: string;
  zIndex: number;
  isVisible: boolean;
  settings: Record<string, unknown>;
}

export interface ReportSaisineAssistantViewModel {
  name: string;
  task: string;
}

export interface ReportSaisineViewModel {
  expert: ReportExpertViewModel | null;
  oathStatement: string;
  courtReference: string;
  swornAt: Date;
  magistrateName: string | null;
  magistrateTitle: string | null;
  ordinanceDate: Date | null;
  missionObject: string | null;
  sealCount: number | null;
  prorogationDeadline: Date | null;
  prorogationOrdinanceDate: Date | null;
  biologicalPrecautions: boolean;
  assistants: ReportSaisineAssistantViewModel[];
}

export interface TechnicalReportViewModel {
  kind: 'TECHNICAL';
  header: ReportHeaderViewModel;
  caseHeader: ReportCaseHeaderViewModel;
  saisine: ReportSaisineViewModel | null;
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
  independentTimestampAt: Date | null;
  integrity: ReportIntegrityViewModel;
  counts: ReportCountsViewModel;
  traces: ReportPieceViewModel[];
  referencePrints: ReportPieceViewModel[];
  identityDemonstrations: ReportIdentityDemonstrationViewModel[];
  annexA: ReportPlateViewModel[];
  annexB: ReportDemonstrationViewModel[];
  verifications: ReportVerificationViewModel[];
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
