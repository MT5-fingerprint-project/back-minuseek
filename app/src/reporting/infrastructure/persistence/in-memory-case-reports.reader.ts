import type { CaseReportReadModel } from '../../application/queries/list-case-reports/case-report-read-model';
import type { CaseReportsReader } from '../../application/queries/list-case-reports/case-reports.reader';

export type StoredCaseReport = CaseReportReadModel & { caseId: string };

function toReadModel(stored: StoredCaseReport): CaseReportReadModel {
  return {
    id: stored.id,
    type: stored.type,
    number: stored.number,
    sha256: stored.sha256,
    createdAt: stored.createdAt,
    generatedByDisplayName: stored.generatedByDisplayName,
    signerDisplayName: stored.signerDisplayName,
  };
}

export class InMemoryCaseReportsReader implements CaseReportsReader {
  readonly store: StoredCaseReport[] = [];

  findByCase(caseId: string): Promise<CaseReportReadModel[]> {
    return Promise.resolve(
      this.store.filter((report) => report.caseId === caseId).map(toReadModel),
    );
  }
}
