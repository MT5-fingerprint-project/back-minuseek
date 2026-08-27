import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InvestigationController } from './infrastructure/http/investigation.controller';
import { OpenInvestigationCaseHandler } from './application/commands/open-investigation-case/open-investigation-case.handler';
import { UpdateInvestigationCaseHandler } from './application/commands/update-investigation-case/update-investigation-case.handler';
import { ListInvestigationCasesHandler } from './application/queries/list-investigation-cases/list-investigation-cases.handler';
import { GetInvestigationCaseHandler } from './application/queries/get-investigation-case/get-investigation-case.handler';
import { PrismaInvestigationCaseRepository } from './infrastructure/persistence/prisma-investigation-case.repository';
import { PrismaInvestigationCaseReader } from './infrastructure/persistence/prisma-investigation-case.reader';
import { PrismaServiceUserDirectory } from './infrastructure/persistence/prisma-service-user.directory';
import { INVESTIGATION_CASE_REPOSITORY } from './domain/investigation-case/repository/investigation-case.repository';
import { INVESTIGATION_CASE_READER } from './application/queries/list-investigation-cases/investigation-case.reader';
import { SERVICE_USER_DIRECTORY } from './application/ports/service-user.directory';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { AccessModule } from '../access/access.module';

@Module({
  imports: [CqrsModule, AuditTrailModule, AccessModule],
  controllers: [InvestigationController],
  providers: [
    OpenInvestigationCaseHandler,
    UpdateInvestigationCaseHandler,
    ListInvestigationCasesHandler,
    GetInvestigationCaseHandler,
    {
      provide: INVESTIGATION_CASE_REPOSITORY,
      useClass: PrismaInvestigationCaseRepository,
    },
    {
      provide: INVESTIGATION_CASE_READER,
      useClass: PrismaInvestigationCaseReader,
    },
    {
      provide: SERVICE_USER_DIRECTORY,
      useClass: PrismaServiceUserDirectory,
    },
  ],
})
export class InvestigationModule {}
