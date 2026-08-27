import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ServiceAccountNotFoundError } from '../../../domain/user/errors/service-account-not-found.error';
import {
  SelfStatusChangeNotAllowedError,
  UserAdministrationNotAllowedError,
} from '../../../domain/user/errors/user-administration-not-allowed.error';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/user/repository/user.repository';
import {
  SERVICE_ACCOUNT_IDENTITY,
  ServiceAccountIdentityPort,
} from '../../ports/service-account-identity.port';
import { DeactivateUserCommand } from './deactivate-user.command';

@CommandHandler(DeactivateUserCommand)
export class DeactivateUserHandler implements ICommandHandler<
  DeactivateUserCommand,
  void
> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepository,
    @Inject(SERVICE_ACCOUNT_IDENTITY)
    private readonly identity: ServiceAccountIdentityPort,
  ) {}

  async execute(cmd: DeactivateUserCommand): Promise<void> {
    if (cmd.requester.role !== UserRoleEnum.ADMIN) {
      throw new UserAdministrationNotAllowedError();
    }
    if (cmd.requester.id === cmd.targetUserId) {
      throw new SelfStatusChangeNotAllowedError();
    }

    const user = await this.repo.findById(cmd.targetUserId);
    if (!user) {
      throw new ServiceAccountNotFoundError(cmd.targetUserId);
    }

    // Le fournisseur d'identité d'abord : lui seul retire la connexion, et un
    // échec doit laisser notre colonne inchangée. Le rejeu la rattrape.
    await this.identity.setEnabled(user.identityProviderId, false);
    user.disable();
    await this.repo.save(user);
  }
}
