import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InvestigationController } from './infrastructure/http/investigation.controller';
import { DeclareCaseExpertiseHandler } from './application/commands/declare-case-expertise/declare-case-expertise.handler';
import { UpdateCaseSaisineHandler } from './application/commands/update-case-saisine/update-case-saisine.handler';
import { VerificationsController } from './infrastructure/http/verifications.controller';
import { OpenInvestigationCaseHandler } from './application/commands/open-investigation-case/open-investigation-case.handler';
import { UpdateInvestigationCaseHandler } from './application/commands/update-investigation-case/update-investigation-case.handler';
import { CloseInvestigationCaseHandler } from './application/commands/close-investigation-case/close-investigation-case.handler';
import { ReopenInvestigationCaseHandler } from './application/commands/reopen-investigation-case/reopen-investigation-case.handler';
import { RequestCaseVerificationHandler } from './application/commands/request-case-verification/request-case-verification.handler';
import { ListInvestigationCasesHandler } from './application/queries/list-investigation-cases/list-investigation-cases.handler';
import { GetInvestigationCaseHandler } from './application/queries/get-investigation-case/get-investigation-case.handler';
import { PrismaCaseExpertiseRepository } from './infrastructure/persistence/prisma-case-expertise.repository';
import { PrismaInvestigationCaseRepository } from './infrastructure/persistence/prisma-investigation-case.repository';
import { PrismaInvestigationCaseReader } from './infrastructure/persistence/prisma-investigation-case.reader';
import { PrismaServiceUserDirectory } from './infrastructure/persistence/prisma-service-user.directory';
import { CASE_EXPERTISE_REPOSITORY } from './domain/case-expertise/repository/case-expertise.repository';
import { ListCaseVerificationsHandler } from './application/queries/list-case-verifications/list-case-verifications.handler';
import { ListMyVerificationsHandler } from './application/queries/list-my-verifications/list-my-verifications.handler';
import { PrismaCaseVerificationRepository } from './infrastructure/persistence/prisma-case-verification.repository';
import { PrismaCaseVerificationReader } from './infrastructure/persistence/prisma-case-verification.reader';
import { INVESTIGATION_CASE_REPOSITORY } from './domain/investigation-case/repository/investigation-case.repository';
import { INVESTIGATION_CASE_READER } from './application/queries/list-investigation-cases/investigation-case.reader';
import { SERVICE_USER_DIRECTORY } from './application/ports/service-user.directory';
import { CASE_VERIFICATION_REPOSITORY } from './domain/case-verification/repository/case-verification.repository';
import { CASE_VERIFICATION_READER } from './application/queries/list-case-verifications/case-verification.reader';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { AccessModule } from '../access/access.module';
import { BiometricsModule } from '../biometrics/biometrics.module';

@Module({
  imports: [CqrsModule, AuditTrailModule, AccessModule, BiometricsModule],
  controllers: [InvestigationController, VerificationsController],
  providers: [
    OpenInvestigationCaseHandler,
    DeclareCaseExpertiseHandler,
    UpdateCaseSaisineHandler,
    UpdateInvestigationCaseHandler,
    CloseInvestigationCaseHandler,
    ReopenInvestigationCaseHandler,
    ListInvestigationCasesHandler,
    GetInvestigationCaseHandler,
    RequestCaseVerificationHandler,
    ListCaseVerificationsHandler,
    ListMyVerificationsHandler,
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
    {
      provide: CASE_VERIFICATION_REPOSITORY,
      useClass: PrismaCaseVerificationRepository,
    },
    {
      provide: CASE_VERIFICATION_READER,
      useClass: PrismaCaseVerificationReader,
    },
  ],
})
export class InvestigationModule {}
