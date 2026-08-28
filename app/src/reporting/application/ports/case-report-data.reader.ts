export interface CaseSummaryData {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  createdAt: Date;
}

export interface LayerData {
  name: string;
  type: string;
  zIndex: number;
  isVisible: boolean;
  settings: Record<string, unknown>;
}

/** Une minutie relevée sur une pièce : coordonnées dans le repère pixel de l'image. */
export interface MinutiaData {
  kind: string;
  x: number;
  y: number;
  radius: number | null;
  angleDeg: number | null;
  color: string | null;
}

export interface PieceData {
  id: string;
  path: string;
  sha256: string | null;
  createdAt: Date;
  capturedAt: Date | null;
  status: string | null;
  score: number | null;
  subjectId: string | null;
  position: string | null;
  layers: LayerData[];
  minutiae: MinutiaData[];
  withdrawnAt: Date | null;
  withdrawalMotive: string | null;
}

export interface SubjectData {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  birthPlace: string;
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

/** Acte d'expert : la correspondance déclarée, socle de la démonstration d'identité. */
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
}

export interface CaseReportDataReader {
  read(caseId: string): Promise<CaseReportData | null>;
}

export const CASE_REPORT_DATA_READER = 'CaseReportDataReader';
