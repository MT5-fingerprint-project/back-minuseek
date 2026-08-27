import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ServiceAccountNotFoundError } from '../../../domain/user/errors/service-account-not-found.error';
import { ServiceNumberAlreadyExistsError } from '../../../domain/user/errors/user-already-registered.error';
import { UserAdministrationNotAllowedError } from '../../../domain/user/errors/user-administration-not-allowed.error';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import {
  USER_REPOSITORY,
  UserRepository,
} from '../../../domain/user/repository/user.repository';
import {
  SERVICE_ACCOUNT_IDENTITY,
  ServiceAccountIdentityPort,
} from '../../ports/service-account-identity.port';
import { CorrectUserProfileCommand } from './correct-user-profile.command';

@CommandHandler(CorrectUserProfileCommand)
export class CorrectUserProfileHandler implements ICommandHandler<
  CorrectUserProfileCommand,
  void
> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly repo: UserRepository,
    @Inject(SERVICE_ACCOUNT_IDENTITY)
    private readonly identity: ServiceAccountIdentityPort,
  ) {}

  async execute(cmd: CorrectUserProfileCommand): Promise<void> {
    if (cmd.requester.role !== UserRoleEnum.ADMIN) {
      throw new UserAdministrationNotAllowedError();
    }

    const user = await this.repo.findById(cmd.targetUserId);
    if (!user) {
      throw new ServiceAccountNotFoundError(cmd.targetUserId);
    }

    // Le dépôt rend une entité détachée : la muter ici valide les champs avant
    // le moindre appel sortant, et l'échec du fournisseur d'identité laisse la
    // base intacte puisque save() n'est jamais atteint.
    const previousServiceNumber = user.serviceNumber;
    user.correctProfile(cmd.correction);

    if (
      user.serviceNumber !== previousServiceNumber &&
      (await this.repo.existsByServiceNumber(user.serviceNumber))
    ) {
      throw new ServiceNumberAlreadyExistsError(user.serviceNumber);
    }

    // Le nom vit aussi chez le fournisseur d'identité, que la barre de
    // navigation affiche ; le grade et le matricule n'existent que chez nous.
    await this.identity.updateProfile(user.identityProviderId, {
      firstName: user.personalData.firstName,
      lastName: user.personalData.lastName,
    });
    await this.repo.save(user);
  }
}
