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
import { ReactivateUserCommand } from './reactivate-user.command';

@CommandHandler(ReactivateUserCommand)
export class ReactivateUserHandler implements ICommandHandler<
  ReactivateUserCommand,
  void
> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepository,
    @Inject(SERVICE_ACCOUNT_IDENTITY)
    private readonly identity: ServiceAccountIdentityPort,
  ) {}

  // Même garde d'auto-cible qu'à la désactivation, et pour une raison plus
  // forte : le jeton émis avant la coupure reste valide jusqu'à son
  // expiration, et son porteur annulerait sinon sa propre désactivation.
  async execute(cmd: ReactivateUserCommand): Promise<void> {
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

    await this.identity.setEnabled(user.identityProviderId, true);
    user.reactivate();
    await this.repo.save(user);
  }
}
