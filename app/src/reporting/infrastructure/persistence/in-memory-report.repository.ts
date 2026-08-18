import { Report } from '../../domain/report/entity/report';
import type { ReportRepository } from '../../domain/report/repository/report.repository';

export class InMemoryReportRepository implements ReportRepository {
  readonly store: Report[] = [];

  save(report: Report): Promise<void> {
    this.store.push(report);
    return Promise.resolve();
  }

  findById(id: string): Promise<Report | null> {
    return Promise.resolve(
      this.store.find((report) => report.id === id) ?? null,
    );
  }

  findByCase(caseId: string): Promise<Report[]> {
    return Promise.resolve(
      this.store.filter((report) => report.caseId === caseId),
    );
  }
}
