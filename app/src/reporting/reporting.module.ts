import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { REPORT_REPOSITORY } from './domain/report/repository/report.repository';
import { PrismaReportRepository } from './infrastructure/persistence/prisma-report.repository';

@Module({
  imports: [CqrsModule],
  providers: [
    {
      provide: REPORT_REPOSITORY,
      useClass: PrismaReportRepository,
    },
  ],
})
export class ReportingModule {}
