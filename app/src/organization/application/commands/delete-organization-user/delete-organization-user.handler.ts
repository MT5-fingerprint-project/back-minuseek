import { Inject, Injectable } from '@nestjs/common';
import { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import {
  IDENTITY_PROVIDER,
  IdentityProviderPort,
} from '../../ports/identity-provider.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { DeleteOrganizationUserCommand } from './delete-organization-user.command';

@Injectable()
export class DeleteOrganizationUserHandler {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
  ) {}

  async execute(command: DeleteOrganizationUserCommand): Promise<void> {
    const record = await this.tenantRegistry.findBySlug(
      command.organizationSlug,
    );
    if (!record) {
      throw new OrganizationNotFoundError(command.organizationSlug);
    }
    await this.identityProvider.deleteUser(
      record.identityProviderRealm,
      command.userId,
    );
  }
}
