import { ReportTypeName } from '../../domain/report/entity/report';

export interface PreviousDocumentData {
  number: string;
  issuedAt: Date;
}

// permet prevenir que des docs sont déjà sortis
export interface ReportNumberingData {
  lastSequence: number;
  previousOfType: PreviousDocumentData | null;
}

export interface ReportNumberingReader {
  read(caseId: string, type: ReportTypeName): Promise<ReportNumberingData>;
}

export const REPORT_NUMBERING_READER = 'ReportNumberingReader';
