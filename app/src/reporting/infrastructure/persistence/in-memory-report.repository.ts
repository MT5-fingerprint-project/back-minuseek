import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { Report } from '../../domain/report/entity/report';
import { ReportSequenceAlreadyTakenError } from '../../domain/report/errors/report-sequence-already-taken.error';
import type { ReportRepository } from '../../domain/report/repository/report.repository';

export class InMemoryReportRepository implements ReportRepository {
  readonly store: Report[] = [];

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  async save(report: Report, act: AuditEventDraft): Promise<AuditLink> {
    const taken = this.store.some(
      (stored) =>
        stored.caseId === report.caseId && stored.sequence === report.sequence,
    );
    if (taken) {
      throw new ReportSequenceAlreadyTakenError(report.caseId, report.sequence);
    }
    this.store.push(report);
    return this.auditTrail.append(act);
  }

  findById(id: string): Promise<Report | null> {
    return Promise.resolve(
      this.store.find((report) => report.id === id) ?? null,
    );
  }
}
