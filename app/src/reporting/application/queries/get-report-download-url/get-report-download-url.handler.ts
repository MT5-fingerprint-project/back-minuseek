import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ReportNotFoundError } from '../../../domain/report/errors/report-not-found.error';
import {
  REPORT_REPOSITORY,
  type ReportRepository,
} from '../../../domain/report/repository/report.repository';
import {
  REPORT_STORAGE,
  type ReportStoragePort,
} from '../../ports/report-storage.port';
import { GetReportDownloadUrlQuery } from './get-report-download-url.query';

@QueryHandler(GetReportDownloadUrlQuery)
export class GetReportDownloadUrlHandler implements IQueryHandler<GetReportDownloadUrlQuery> {
  constructor(
    @Inject(REPORT_REPOSITORY)
    private readonly repository: ReportRepository,
    @Inject(REPORT_STORAGE)
    private readonly storage: ReportStoragePort,
  ) {}

  async execute(
    query: GetReportDownloadUrlQuery,
  ): Promise<{ url: string; sha256: string }> {
    const report = await this.repository.findById(query.reportId);
    if (!report) {
      throw new ReportNotFoundError(query.reportId);
    }
    return {
      url: await this.storage.getUrl(report.storagePath),
      sha256: report.sha256,
    };
  }
}
