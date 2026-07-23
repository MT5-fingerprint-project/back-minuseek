import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UserController } from './infrastructure/http/user.controller';
import { GetUserByProviderIdHandler } from './application/queries/get-user-by-provider-id/get-user-by-provider-id.handler';
import { RegisterUserHandler } from './application/commands/register-user/register-user.handler';
import { PrismaUserReader } from './infrastructure/persistence/prisma-user.reader';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { USER_READER } from './application/queries/get-user-by-provider-id/user.reader';
import { USER_REPOSITORY } from './domain/user/repository/user.repository';

@Module({
  imports: [CqrsModule],
  controllers: [UserController],
  providers: [
    GetUserByProviderIdHandler,
    RegisterUserHandler,
    {
      provide: USER_READER,
      useClass: PrismaUserReader,
    },
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
  ],
})
export class IdentityAccessModule {}
