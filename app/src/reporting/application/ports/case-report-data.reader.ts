export interface CaseRecipientData {
  authority: string | null;
  attentionQuality: string | null;
  attentionName: string | null;
}

export interface CaseSummaryData {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  createdAt: Date;
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
  recipient: CaseRecipientData;
}

export interface LayerData {
  name: string;
  type: string;
  zIndex: number;
  isVisible: boolean;
  settings: Record<string, unknown>;
}

export interface MinutiaData {
  kind: string;
  x: number;
  y: number;
  radius: number | null;
  angleDeg: number | null;
  color: string | null;
  typeLabel: string | null;
}

export interface MinutiaPairData {
  traceId: string;
  referencePrintId: string;
  traceMinutiaRank: number;
  referenceMinutiaRank: number;
}

export interface LocationPhotoData {
  path: string;
  sha256: string;
  sealedAt: Date;
}

export interface PieceData {
  id: string;
  path: string;
  sha256: string | null;
  displayableSha256: string | null;
  createdAt: Date;
  capturedAt: Date | null;
  status: string | null;
  subjectId: string | null;
  position: string | null;
  layers: LayerData[];
  minutiae: MinutiaData[];
  withdrawnAt: Date | null;
  withdrawalMotive: string | null;
  imageDestroyedAt: Date | null;
  number: number | null;
  origin: string | null;
  location: string | null;
  revelationTechnique: string | null;
  cote: string | null;
  notIdentifiedAt: Date | null;
  locationPhoto: LocationPhotoData | null;
}

export interface SubjectData {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  birthPlace: string | null;
  sex: string;
  type: string;
}

export interface ExpertData {
  firstName: string;
  lastName: string;
  grade: string;
  serviceNumber: string;
  role: string;
}

export interface ComparisonData {
  traceId: string;
  referencePrintId: string;
  score: number;
  machineMatch: boolean;
  declaredHit: boolean;
  comparedAt: Date;
}

export interface DeclaredHitData {
  traceId: string;
  referencePrintId: string;
  declaredAt: Date;
  declaredBy: ExpertData | null;
  withdrawnAt: Date | null;
}

export interface SaisineAssistantData {
  name: string;
  task: string;
}

export interface ExpertiseData {
  expert: ExpertData | null;
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
  assistants: SaisineAssistantData[];
}

export interface VerifierData extends ExpertData {
  identityProviderId: string;
}

export interface VerificationDecisionData {
  traceId: string;
  exploitability: string;
  identifiedReferencePrintId: string | null;
  outcome: string | null;
  statedAt: Date;
}

export interface VerificationReportData {
  id: string;
  verifier: VerifierData | null;
  status: string;
  requestedAt: Date;
  completedAt: Date | null;
  decisions: VerificationDecisionData[];
}

export interface CaseReportData {
  investigationCase: CaseSummaryData;
  expertise: ExpertiseData | null;
  traces: PieceData[];
  referencePrints: PieceData[];
  comparisons: ComparisonData[];
  declaredHits: DeclaredHitData[];
  subjects: SubjectData[];
  minutiaPairs: MinutiaPairData[];
  verifications: VerificationReportData[];
}

export interface CaseReportDataReader {
  read(caseId: string): Promise<CaseReportData | null>;
}

export const CASE_REPORT_DATA_READER = 'CaseReportDataReader';
