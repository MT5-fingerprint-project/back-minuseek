import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InvestigationController } from './infrastructure/http/investigation.controller';
import { RecipientBookController } from './infrastructure/http/recipient-book.controller';
import { DeclareCaseExpertiseHandler } from './application/commands/declare-case-expertise/declare-case-expertise.handler';
import { UpdateCaseSaisineHandler } from './application/commands/update-case-saisine/update-case-saisine.handler';
import { VerificationsController } from './infrastructure/http/verifications.controller';
import { OpenInvestigationCaseHandler } from './application/commands/open-investigation-case/open-investigation-case.handler';
import { UpdateInvestigationCaseHandler } from './application/commands/update-investigation-case/update-investigation-case.handler';
import { CloseInvestigationCaseHandler } from './application/commands/close-investigation-case/close-investigation-case.handler';
import { ReopenInvestigationCaseHandler } from './application/commands/reopen-investigation-case/reopen-investigation-case.handler';
import { ChangeCaseStatusHandler } from './application/commands/change-case-status/change-case-status.handler';
import { RequestCaseVerificationHandler } from './application/commands/request-case-verification/request-case-verification.handler';
import { RecordVerificationConclusionHandler } from './application/commands/record-verification-conclusion/record-verification-conclusion.handler';
import { CompleteCaseVerificationHandler } from './application/commands/complete-case-verification/complete-case-verification.handler';
import { ListInvestigationCasesHandler } from './application/queries/list-investigation-cases/list-investigation-cases.handler';
import { GetInvestigationCaseHandler } from './application/queries/get-investigation-case/get-investigation-case.handler';
import { AddRecipientBookEntryHandler } from './application/commands/add-recipient-book-entry/add-recipient-book-entry.handler';
import { RemoveRecipientBookEntryHandler } from './application/commands/remove-recipient-book-entry/remove-recipient-book-entry.handler';
import { UpdateCaseRecipientHandler } from './application/commands/update-case-recipient/update-case-recipient.handler';
import { ListRecipientBookEntriesHandler } from './application/queries/list-recipient-book-entries/list-recipient-book-entries.handler';
import { PrismaRecipientBookEntryRepository } from './infrastructure/persistence/prisma-recipient-book-entry.repository';
import { PrismaRecipientBookEntriesReader } from './infrastructure/persistence/prisma-recipient-book-entries.reader';
import { RECIPIENT_BOOK_ENTRY_REPOSITORY } from './domain/recipient-book-entry/repository/recipient-book-entry.repository';
import { RECIPIENT_BOOK_ENTRIES_READER } from './application/queries/list-recipient-book-entries/recipient-book-entries.reader';
import { GetMyWorkHandler } from './application/queries/get-my-work/get-my-work.handler';
import { MY_WORK_READER } from './application/queries/get-my-work/my-work.reader';
import { MyWorkController } from './infrastructure/http/my-work.controller';
import { PrismaMyWorkReader } from './infrastructure/persistence/prisma-my-work.reader';
import { GetServiceActivityHandler } from './application/queries/get-service-activity/get-service-activity.handler';
import { SERVICE_ACTIVITY_READER } from './application/queries/get-service-activity/service-activity.reader';
import { ServiceActivityController } from './infrastructure/http/service-activity.controller';
import { PrismaServiceActivityReader } from './infrastructure/persistence/prisma-service-activity.reader';
import { PrismaCaseExpertiseRepository } from './infrastructure/persistence/prisma-case-expertise.repository';
import { ListCaseVerificationsHandler } from './application/queries/list-case-verifications/list-case-verifications.handler';
import { ListMyVerificationsHandler } from './application/queries/list-my-verifications/list-my-verifications.handler';
import { GetVerificationHandler } from './application/queries/get-verification/get-verification.handler';
import { PrismaInvestigationCaseRepository } from './infrastructure/persistence/prisma-investigation-case.repository';
import { PrismaInvestigationCaseReader } from './infrastructure/persistence/prisma-investigation-case.reader';
import { PrismaServiceUserDirectory } from './infrastructure/persistence/prisma-service-user.directory';
import { CASE_EXPERTISE_REPOSITORY } from './domain/case-expertise/repository/case-expertise.repository';
import { PrismaCaseVerificationRepository } from './infrastructure/persistence/prisma-case-verification.repository';
import { PrismaCaseVerificationReader } from './infrastructure/persistence/prisma-case-verification.reader';
import { PrismaVerificationDecisionRepository } from './infrastructure/persistence/prisma-verification-decision.repository';
import { INVESTIGATION_CASE_REPOSITORY } from './domain/investigation-case/repository/investigation-case.repository';
import { INVESTIGATION_CASE_READER } from './application/queries/list-investigation-cases/investigation-case.reader';
import { SERVICE_USER_DIRECTORY } from './application/ports/service-user.directory';
import { CASE_VERIFICATION_REPOSITORY } from './domain/case-verification/repository/case-verification.repository';
import { CASE_VERIFICATION_READER } from './application/queries/list-case-verifications/case-verification.reader';
import { VERIFICATION_DECISION_REPOSITORY } from './domain/case-verification/repository/verification-decision.repository';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { AccessModule } from '../access/access.module';
import { BiometricsModule } from '../biometrics/biometrics.module';

@Module({
  imports: [CqrsModule, AuditTrailModule, AccessModule, BiometricsModule],
  controllers: [
    InvestigationController,
    RecipientBookController,
    VerificationsController,
    ServiceActivityController,
    MyWorkController,
  ],
  providers: [
    OpenInvestigationCaseHandler,
    DeclareCaseExpertiseHandler,
    UpdateCaseSaisineHandler,
    UpdateInvestigationCaseHandler,
    CloseInvestigationCaseHandler,
    ReopenInvestigationCaseHandler,
    ChangeCaseStatusHandler,
    ListInvestigationCasesHandler,
    GetInvestigationCaseHandler,
    GetServiceActivityHandler,
    GetMyWorkHandler,
    RequestCaseVerificationHandler,
    RecordVerificationConclusionHandler,
    CompleteCaseVerificationHandler,
    ListCaseVerificationsHandler,
    ListMyVerificationsHandler,
    GetVerificationHandler,
    AddRecipientBookEntryHandler,
    RemoveRecipientBookEntryHandler,
    UpdateCaseRecipientHandler,
    ListRecipientBookEntriesHandler,
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
      provide: SERVICE_ACTIVITY_READER,
      useClass: PrismaServiceActivityReader,
    },
    {
      provide: MY_WORK_READER,
      useClass: PrismaMyWorkReader,
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
    {
      provide: VERIFICATION_DECISION_REPOSITORY,
      useClass: PrismaVerificationDecisionRepository,
    },
    {
      provide: RECIPIENT_BOOK_ENTRY_REPOSITORY,
      useClass: PrismaRecipientBookEntryRepository,
    },
    {
      provide: RECIPIENT_BOOK_ENTRIES_READER,
      useClass: PrismaRecipientBookEntriesReader,
    },
  ],
})
export class InvestigationModule {}
