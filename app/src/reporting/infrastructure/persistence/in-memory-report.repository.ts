import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { Report } from '../../domain/report/entity/report';
import type { ReportRepository } from '../../domain/report/repository/report.repository';

export class InMemoryReportRepository implements ReportRepository {
  readonly store: Report[] = [];

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  async save(report: Report, act: AuditEventDraft): Promise<void> {
    this.store.push(report);
    await this.auditTrail.append(act);
  }

  findById(id: string): Promise<Report | null> {
    return Promise.resolve(
      this.store.find((report) => report.id === id) ?? null,
    );
  }
}
