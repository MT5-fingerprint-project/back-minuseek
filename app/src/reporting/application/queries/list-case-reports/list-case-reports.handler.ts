import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CaseReportReadModel } from './case-report-read-model';
import { CASE_REPORTS_READER, CaseReportsReader } from './case-reports.reader';
import { ListCaseReportsQuery } from './list-case-reports.query';

@QueryHandler(ListCaseReportsQuery)
export class ListCaseReportsHandler implements IQueryHandler<ListCaseReportsQuery> {
  constructor(
    @Inject(CASE_REPORTS_READER)
    private readonly reader: CaseReportsReader,
  ) {}

  execute(query: ListCaseReportsQuery): Promise<CaseReportReadModel[]> {
    return this.reader.findByCase(query.caseId);
  }
}
