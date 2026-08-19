import { Report } from '../entity/report';

export interface ReportRepository {
  save(report: Report): Promise<void>;
  findById(id: string): Promise<Report | null>;
}

export const REPORT_REPOSITORY = 'ReportRepository';
