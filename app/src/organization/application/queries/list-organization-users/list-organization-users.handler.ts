import { Inject, Injectable } from '@nestjs/common';
import { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import {
  IDENTITY_PROVIDER,
  IdentityProviderPort,
  TenantUser,
} from '../../ports/identity-provider.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { ListOrganizationUsersQuery } from './list-organization-users.query';

@Injectable()
export class ListOrganizationUsersHandler {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
  ) {}

  async execute(query: ListOrganizationUsersQuery): Promise<TenantUser[]> {
    const record = await this.tenantRegistry.findBySlug(query.organizationSlug);
    if (!record) {
      throw new OrganizationNotFoundError(query.organizationSlug);
    }
    return this.identityProvider.listUsers(record.identityProviderRealm);
  }
}
