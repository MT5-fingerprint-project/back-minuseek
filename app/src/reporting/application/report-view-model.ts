export interface ReportHeaderViewModel {
  reportId: string;
  /** Tête de chaîne au moment du rendu : le document ne peut pas porter son
   * propre sha256, il porte donc le maillon auquel il se rattache. */
  chainHeadSeq: number | null;
  chainHeadHash: string | null;
  caseNumber: string;
  pvNumber: string;
  caseStatus: string;
  openedAt: Date;
  generatedAt: Date;
  generatedByDisplayName: string;
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
  exploitabilityScore: number | null;
  image: ReportImageViewModel | null;
  minutiae: ReportMinutiaViewModel[];
  layers: ReportLayerViewModel[];
  withdrawal: ReportWithdrawalViewModel | null;
}

export interface ReportSubjectViewModel {
  firstName: string;
  lastName: string;
  birthDate: Date;
  birthPlace: string;
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
  score: number | null;
  machineMatch: boolean | null;
  comparedAt: Date | null;
  declaredAt: Date;
  declaredBy: ReportExpertViewModel | null;
  requiredMinutiae: number;
}

export interface ReportJournalEntryViewModel {
  label: string;
  detail: string | null;
  occurredAt: Date;
  actorDisplayName: string;
  seq: number;
  hash: string;
}

export interface ReportJournalViewModel {
  chained: ReportJournalEntryViewModel[];
}

export interface ReportLayerViewModel {
  name: string;
  type: string;
  zIndex: number;
  isVisible: boolean;
  settings: Record<string, unknown>;
}

export interface ReportComparisonViewModel {
  traceLabel: string;
  referencePrintLabel: string;
  score: number;
  machineMatch: boolean;
  declaredHit: boolean;
  comparedAt: Date;
}

export interface TechnicalReportViewModel {
  kind: 'TECHNICAL';
  header: ReportHeaderViewModel;
  caseDescription: string | null;
  traces: ReportPieceViewModel[];
  referencePrints: ReportPieceViewModel[];
  comparisons: ReportComparisonViewModel[];
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
  /** Épine de hashes du tenant, genesis → tête (ADR-0012, point 6). */
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
