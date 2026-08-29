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

export interface CaseReportData {
  investigationCase: CaseSummaryData;
  traces: PieceData[];
  referencePrints: PieceData[];
  comparisons: ComparisonData[];
  declaredHits: DeclaredHitData[];
  subjects: SubjectData[];
  minutiaPairs: MinutiaPairData[];
}

export interface CaseReportDataReader {
  read(caseId: string): Promise<CaseReportData | null>;
}

export const CASE_REPORT_DATA_READER = 'CaseReportDataReader';
