import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserController } from './infrastructure/http/user.controller';
import { SubjectController } from './infrastructure/http/subject.controller';
import { GetUserByProviderIdHandler } from './application/queries/get-user-by-provider-id/get-user-by-provider-id.handler';
import { RegisterUserHandler } from './application/commands/register-user/register-user.handler';
import { GetSubjectByIdHandler } from './application/queries/get-subject-by-id/get-subject-by-id.handler';
import { ListSubjectsByCaseHandler } from './application/queries/list-subjects-by-case/list-subjects-by-case.handler';
import { RegisterSubjectHandler } from './application/commands/register-subject/register-subject.handler';
import { LinkSubjectToCaseHandler } from './application/commands/link-subject-to-case/link-subject-to-case.handler';
import { PrismaUserReader } from './infrastructure/persistence/prisma-user.reader';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { PrismaSubjectReader } from './infrastructure/persistence/prisma-subject.reader';
import { PrismaSubjectRepository } from './infrastructure/persistence/prisma-subject.repository';
import { PrismaSubjectCaseRepository } from './infrastructure/persistence/prisma-subject-case.repository';
import { PrismaCaseSubjectsReader } from './infrastructure/persistence/prisma-case-subjects.reader';
import { USER_READER } from './application/queries/get-user-by-provider-id/user.reader';
import { USER_REPOSITORY } from './domain/user/repository/user.repository';
import { SUBJECT_READER } from './application/queries/get-subject-by-id/subject.reader';
import { SUBJECT_REPOSITORY } from './domain/subject/repository/subject.repository';
import { SUBJECT_CASE_REPOSITORY } from './domain/subject-case/repository/subject-case.repository';
import { CASE_SUBJECTS_READER } from './application/queries/list-subjects-by-case/case-subjects.reader';

@Module({
  imports: [CqrsModule],
  controllers: [UserController, SubjectController],
  providers: [
    GetUserByProviderIdHandler,
    RegisterUserHandler,
    GetSubjectByIdHandler,
    ListSubjectsByCaseHandler,
    RegisterSubjectHandler,
    LinkSubjectToCaseHandler,
    {
      provide: USER_READER,
      useClass: PrismaUserReader,
    },
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: SUBJECT_READER,
      useClass: PrismaSubjectReader,
    },
    {
      provide: SUBJECT_REPOSITORY,
      useClass: PrismaSubjectRepository,
    },
    {
      provide: SUBJECT_CASE_REPOSITORY,
      useClass: PrismaSubjectCaseRepository,
    },
    {
      provide: CASE_SUBJECTS_READER,
      useClass: PrismaCaseSubjectsReader,
    },
  ],
})
export class IdentityAccessModule {}
