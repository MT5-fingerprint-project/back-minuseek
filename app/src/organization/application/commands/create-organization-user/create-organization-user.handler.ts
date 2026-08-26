import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import {
  CreatedUser,
  IDENTITY_PROVIDER,
  IdentityProviderPort,
} from '../../ports/identity-provider.port';
import {
  SERVICE_USER_REGISTRAR,
  ServiceUserRegistrarPort,
} from '../../ports/service-user-registrar.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { CreateOrganizationUserCommand } from './create-organization-user.command';

@Injectable()
export class CreateOrganizationUserHandler {
  private readonly logger = new Logger(CreateOrganizationUserHandler.name);

  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
    @Inject(SERVICE_USER_REGISTRAR)
    private readonly serviceUserRegistrar: ServiceUserRegistrarPort,
  ) {}

  async execute(command: CreateOrganizationUserCommand): Promise<CreatedUser> {
    const record = await this.tenantRegistry.findBySlug(
      command.organizationSlug,
    );
    if (!record) {
      throw new OrganizationNotFoundError(command.organizationSlug);
    }

    const account = await this.identityProvider.createUser(
      record.identityProviderRealm,
      {
        email: command.email,
        firstName: command.firstName,
        lastName: command.lastName,
      },
    );

    try {
      await this.serviceUserRegistrar.register({
        organizationSlug: record.slug,
        identityProviderId: account.id,
        role: command.role,
        grade: command.grade,
        serviceNumber: command.serviceNumber,
        firstName: command.firstName,
        lastName: command.lastName,
      });
    } catch (error) {
      if (account.created) {
        await this.deleteAccount(record.identityProviderRealm, account.id);
      }
      throw error;
    }

    return account;
  }

  /** L'échec de la compensation ne doit pas masquer la cause du refus. */
  private async deleteAccount(realm: string, userId: string): Promise<void> {
    try {
      await this.identityProvider.deleteUser(realm, userId);
    } catch (deletionError) {
      this.logger.warn(
        `Compensation en échec (suppression du compte ${userId} du realm ${realm}): ${String(deletionError)}`,
      );
    }
  }
}
