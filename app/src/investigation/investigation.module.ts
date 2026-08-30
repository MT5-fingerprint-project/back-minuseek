import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InvestigationController } from './infrastructure/http/investigation.controller';
import { DeclareCaseExpertiseHandler } from './application/commands/declare-case-expertise/declare-case-expertise.handler';
import { OpenInvestigationCaseHandler } from './application/commands/open-investigation-case/open-investigation-case.handler';
import { UpdateInvestigationCaseHandler } from './application/commands/update-investigation-case/update-investigation-case.handler';
import { CloseInvestigationCaseHandler } from './application/commands/close-investigation-case/close-investigation-case.handler';
import { ReopenInvestigationCaseHandler } from './application/commands/reopen-investigation-case/reopen-investigation-case.handler';
import { ListInvestigationCasesHandler } from './application/queries/list-investigation-cases/list-investigation-cases.handler';
import { GetInvestigationCaseHandler } from './application/queries/get-investigation-case/get-investigation-case.handler';
import { PrismaCaseExpertiseRepository } from './infrastructure/persistence/prisma-case-expertise.repository';
import { PrismaInvestigationCaseRepository } from './infrastructure/persistence/prisma-investigation-case.repository';
import { PrismaInvestigationCaseReader } from './infrastructure/persistence/prisma-investigation-case.reader';
import { PrismaServiceUserDirectory } from './infrastructure/persistence/prisma-service-user.directory';
import { CASE_EXPERTISE_REPOSITORY } from './domain/case-expertise/repository/case-expertise.repository';
import { INVESTIGATION_CASE_REPOSITORY } from './domain/investigation-case/repository/investigation-case.repository';
import { INVESTIGATION_CASE_READER } from './application/queries/list-investigation-cases/investigation-case.reader';
import { SERVICE_USER_DIRECTORY } from './application/ports/service-user.directory';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { AccessModule } from '../access/access.module';
import { BiometricsModule } from '../biometrics/biometrics.module';

@Module({
  imports: [CqrsModule, AuditTrailModule, AccessModule, BiometricsModule],
  controllers: [InvestigationController],
  providers: [
    OpenInvestigationCaseHandler,
    DeclareCaseExpertiseHandler,
    UpdateInvestigationCaseHandler,
    CloseInvestigationCaseHandler,
    ReopenInvestigationCaseHandler,
    ListInvestigationCasesHandler,
    GetInvestigationCaseHandler,
    {
      provide: INVESTIGATION_CASE_REPOSITORY,
      useClass: PrismaInvestigationCaseRepository,
    },
    {
      provide: CASE_EXPERTISE_REPOSITORY,
      useClass: PrismaCaseExpertiseRepository,
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
