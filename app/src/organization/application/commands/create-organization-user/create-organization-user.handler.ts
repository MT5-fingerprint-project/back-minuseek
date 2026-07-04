import { Inject, Injectable } from '@nestjs/common';
import { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import {
  CreatedUser,
  IDENTITY_PROVIDER,
  IdentityProviderPort,
} from '../../ports/identity-provider.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { CreateOrganizationUserCommand } from './create-organization-user.command';

@Injectable()
export class CreateOrganizationUserHandler {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
  ) {}

  async execute(command: CreateOrganizationUserCommand): Promise<CreatedUser> {
    const record = await this.tenantRegistry.findBySlug(
      command.organizationSlug,
    );
    if (!record) {
      throw new OrganizationNotFoundError(command.organizationSlug);
    }
    return this.identityProvider.createUser(record.identityProviderRealm, {
      email: command.email,
      firstName: command.firstName,
      lastName: command.lastName,
    });
  }
}
