import {
  JournalDetailName,
  ReportTypeName,
} from '../../../domain/report/entity/report';

export interface CaseReportReadModel {
  id: string;
  type: ReportTypeName;
  number: string;
  journalDetail: JournalDetailName;
  sha256: string;
  createdAt: Date;
  generatedByDisplayName: string;
  signerDisplayName: string | null;
}
