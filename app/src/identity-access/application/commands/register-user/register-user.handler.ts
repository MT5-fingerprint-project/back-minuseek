import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { User } from '../../../domain/user/entity/user';
import { UserRole } from '../../../domain/user/value-objects/user-role.vo';
import { PersonalData } from '../../../domain/user/value-objects/personal-data.vo';
import {
  ServiceNumberAlreadyExistsError,
  UserAlreadyRegisteredError,
} from '../../../domain/user/errors/user-already-registered.error';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/user/repository/user.repository';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<
  RegisterUserCommand,
  string
> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: RegisterUserCommand): Promise<string> {
    if (await this.repo.existsByIdentityProviderId(cmd.identityProviderId)) {
      throw new UserAlreadyRegisteredError(cmd.identityProviderId);
    }
    if (await this.repo.existsByServiceNumber(cmd.serviceNumber)) {
      throw new ServiceNumberAlreadyExistsError(cmd.serviceNumber);
    }

    const id = this.idGenerator.generate();
    const user = User.register({
      id,
      identityProviderId: cmd.identityProviderId,
      role: UserRole.from(cmd.role),
      grade: cmd.grade,
      serviceNumber: cmd.serviceNumber,
      personalData: PersonalData.of({
        firstName: cmd.firstName,
        lastName: cmd.lastName,
      }),
    });

    await this.repo.save(user);
    return id;
  }
}
