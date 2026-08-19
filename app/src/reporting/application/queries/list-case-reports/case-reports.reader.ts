import { CaseReportReadModel } from './case-report-read-model';

export interface CaseReportsReader {
  findByCase(caseId: string): Promise<CaseReportReadModel[]>;
}

export const CASE_REPORTS_READER = 'CaseReportsReader';
