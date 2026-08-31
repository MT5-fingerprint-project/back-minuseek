import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserController } from './infrastructure/http/user.controller';
import { SubjectController } from './infrastructure/http/subject.controller';
import { MeController } from './infrastructure/http/me.controller';
import { GetUserByProviderIdHandler } from './application/queries/get-user-by-provider-id/get-user-by-provider-id.handler';
import { RegisterUserHandler } from './application/commands/register-user/register-user.handler';
import { DeactivateUserHandler } from './application/commands/deactivate-user/deactivate-user.handler';
import { ReactivateUserHandler } from './application/commands/reactivate-user/reactivate-user.handler';
import { CorrectUserProfileHandler } from './application/commands/correct-user-profile/correct-user-profile.handler';
import { ListUsersHandler } from './application/queries/list-users/list-users.handler';
import { ListUserGradesHandler } from './application/queries/list-user-grades/list-user-grades.handler';
import { GetSubjectByIdHandler } from './application/queries/get-subject-by-id/get-subject-by-id.handler';
import { ListSubjectsByCaseHandler } from './application/queries/list-subjects-by-case/list-subjects-by-case.handler';
import { RegisterSubjectHandler } from './application/commands/register-subject/register-subject.handler';
import { PrismaUserReader } from './infrastructure/persistence/prisma-user.reader';
import { PrismaServiceUsersReader } from './infrastructure/persistence/prisma-service-users.reader';
import { PrismaServiceUserGradesReader } from './infrastructure/persistence/prisma-service-user-grades.reader';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { PrismaSubjectReader } from './infrastructure/persistence/prisma-subject.reader';
import { PrismaSubjectRepository } from './infrastructure/persistence/prisma-subject.repository';
import { PrismaCaseSubjectsReader } from './infrastructure/persistence/prisma-case-subjects.reader';
import { USER_READER } from './application/queries/get-user-by-provider-id/user.reader';
import { SERVICE_USERS_READER } from './application/queries/list-users/service-users.reader';
import { SERVICE_USER_GRADES_READER } from './application/queries/list-user-grades/service-user-grades.reader';
import { USER_REPOSITORY } from './domain/user/repository/user.repository';
import { SUBJECT_READER } from './application/queries/get-subject-by-id/subject.reader';
import { SUBJECT_REPOSITORY } from './domain/subject/repository/subject.repository';
import { CASE_SUBJECTS_READER } from './application/queries/list-subjects-by-case/case-subjects.reader';
import { SERVICE_ACCOUNT_IDENTITY } from './application/ports/service-account-identity.port';
import { KeycloakServiceAccountIdentityAdapter } from './infrastructure/keycloak/keycloak-service-account-identity.adapter';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  // OrganizationModule pour le seul IDENTITY_PROVIDER : le client admin Keycloak
  // y est déjà câblé, en dupliquer un second ouvrirait une seconde session.
  imports: [CqrsModule, AuditTrailModule, OrganizationModule],
  controllers: [UserController, MeController, SubjectController],
  providers: [
    GetUserByProviderIdHandler,
    ListUsersHandler,
    ListUserGradesHandler,
    RegisterUserHandler,
    DeactivateUserHandler,
    ReactivateUserHandler,
    CorrectUserProfileHandler,
    GetSubjectByIdHandler,
    ListSubjectsByCaseHandler,
    RegisterSubjectHandler,
    {
      provide: USER_READER,
      useClass: PrismaUserReader,
    },
    {
      provide: SERVICE_USERS_READER,
      useClass: PrismaServiceUsersReader,
    },
    {
      provide: SERVICE_USER_GRADES_READER,
      useClass: PrismaServiceUserGradesReader,
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
      provide: CASE_SUBJECTS_READER,
      useClass: PrismaCaseSubjectsReader,
    },
    {
      provide: SERVICE_ACCOUNT_IDENTITY,
      useClass: KeycloakServiceAccountIdentityAdapter,
    },
  ],
})
export class IdentityAccessModule {}
