import {
  AuditEventDraft,
  AuditLink,
} from '../../../../shared/domain/ports/audit-trail.port';
import { Report } from '../entity/report';

export interface ReportRepository {
  save(report: Report, act: AuditEventDraft): Promise<AuditLink>;
  findById(id: string): Promise<Report | null>;
}

export const REPORT_REPOSITORY = 'ReportRepository';
