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

export interface PieceData {
  id: string;
  path: string;
  sha256: string | null;
  createdAt: Date;
  capturedAt: Date | null;
  status: string | null;
  score: number | null;
  layers: LayerData[];
}

export interface ComparisonData {
  traceId: string;
  referencePrintId: string;
  score: number;
  machineMatch: boolean;
  declaredHit: boolean;
  comparedAt: Date;
}

export interface CaseReportData {
  investigationCase: CaseSummaryData;
  traces: PieceData[];
  referencePrints: PieceData[];
  comparisons: ComparisonData[];
}

export interface CaseReportDataReader {
  read(caseId: string): Promise<CaseReportData | null>;
}

export const CASE_REPORT_DATA_READER = 'CaseReportDataReader';
