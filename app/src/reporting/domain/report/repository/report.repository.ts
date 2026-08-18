import { Report } from '../entity/report';

export interface ReportRepository {
  save(report: Report): Promise<void>;
  findById(id: string): Promise<Report | null>;
  findByCase(caseId: string): Promise<Report[]>;
}

export const REPORT_REPOSITORY = 'ReportRepository';
