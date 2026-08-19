import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { GenerateReportHandler } from './application/commands/generate-report/generate-report.handler';
import { CASE_REPORT_DATA_READER } from './application/ports/case-report-data.reader';
import { CHAIN_ATTESTATION } from './application/ports/chain-attestation.port';
import { CHAIN_HEAD_READER } from './application/ports/chain-head.reader';
import { REPORT_IMAGE_EMBEDDER } from './application/ports/report-image-embedder.port';
import { REPORT_RENDERER } from './application/ports/report-renderer.port';
import { REPORT_STORAGE } from './application/ports/report-storage.port';
import { TRACEABILITY_DATA_READER } from './application/ports/traceability-data.reader';
import { GetReportDownloadUrlHandler } from './application/queries/get-report-download-url/get-report-download-url.handler';
import { CASE_REPORTS_READER } from './application/queries/list-case-reports/case-reports.reader';
import { ListCaseReportsHandler } from './application/queries/list-case-reports/list-case-reports.handler';
import { REPORT_REPOSITORY } from './domain/report/repository/report.repository';
import { QueryBusChainAttestationAdapter } from './infrastructure/audit/query-bus-chain-attestation.adapter';
import { ReportsController } from './infrastructure/http/reports.controller';
import { PuppeteerReportRenderer } from './infrastructure/pdf/puppeteer-report.renderer';
import { StorageReportImageEmbedder } from './infrastructure/pdf/storage-report-image.embedder';
import { PrismaCaseReportDataReader } from './infrastructure/persistence/prisma-case-report-data.reader';
import { PrismaCaseReportsReader } from './infrastructure/persistence/prisma-case-reports.reader';
import { PrismaChainHeadReader } from './infrastructure/persistence/prisma-chain-head.reader';
import { PrismaReportRepository } from './infrastructure/persistence/prisma-report.repository';
import { PrismaTraceabilityDataReader } from './infrastructure/persistence/prisma-traceability-data.reader';
import { GcsReportStorageAdapter } from './infrastructure/storage/gcs-report-storage.adapter';
import { InMemoryReportStorageAdapter } from './infrastructure/storage/in-memory-report-storage.adapter';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

@Module({
  imports: [CqrsModule, AuditTrailModule],
  controllers: [ReportsController],
  providers: [
    GenerateReportHandler,
    ListCaseReportsHandler,
    GetReportDownloadUrlHandler,
    { provide: REPORT_REPOSITORY, useClass: PrismaReportRepository },
    { provide: CASE_REPORTS_READER, useClass: PrismaCaseReportsReader },
    { provide: CASE_REPORT_DATA_READER, useClass: PrismaCaseReportDataReader },
    {
      provide: TRACEABILITY_DATA_READER,
      useClass: PrismaTraceabilityDataReader,
    },
    { provide: CHAIN_HEAD_READER, useClass: PrismaChainHeadReader },
    { provide: CHAIN_ATTESTATION, useClass: QueryBusChainAttestationAdapter },
    { provide: REPORT_IMAGE_EMBEDDER, useClass: StorageReportImageEmbedder },
    { provide: REPORT_RENDERER, useClass: PuppeteerReportRenderer },
    {
      provide: REPORT_STORAGE,
      useFactory: ():
        | GcsReportStorageAdapter
        | InMemoryReportStorageAdapter => {
        const driver = process.env.STORAGE_DRIVER ?? 'gcs';
        if (driver === 'in-memory') {
          return new InMemoryReportStorageAdapter();
        }
        if (driver !== 'gcs') {
          throw new Error(
            `Unknown STORAGE_DRIVER "${driver}" (expected gcs | in-memory)`,
          );
        }
        const bucket = process.env.GCS_BUCKET;
        if (!bucket) {
          throw new Error('STORAGE_DRIVER=gcs requires GCS_BUCKET to be set');
        }
        const ttl = Number(
          process.env.GCS_SIGNED_URL_TTL_SECONDS ??
            DEFAULT_SIGNED_URL_TTL_SECONDS,
        );
        return new GcsReportStorageAdapter(bucket, ttl);
      },
    },
  ],
})
export class ReportingModule {}
