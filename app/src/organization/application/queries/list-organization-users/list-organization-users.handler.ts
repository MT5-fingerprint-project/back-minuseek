import { Inject, Injectable } from '@nestjs/common';
import { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import {
  IDENTITY_PROVIDER,
  IdentityProviderPort,
  TenantUser,
} from '../../ports/identity-provider.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { ListOrganizationUsersQuery } from './list-organization-users.query';
import { PageDto } from '../../../../shared/application/pagination/page.dto';

@Injectable()
export class ListOrganizationUsersHandler {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
  ) {}

  async execute(
    query: ListOrganizationUsersQuery,
  ): Promise<PageDto<TenantUser>> {
    const record = await this.tenantRegistry.findBySlug(query.organizationSlug);
    if (!record) {
      throw new OrganizationNotFoundError(query.organizationSlug);
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const first = (page - 1) * limit;
    const { items, total } = await this.identityProvider.listUsers(
      record.identityProviderRealm,
      { first, max: limit },
    );

    return new PageDto(items, {
      itemCount: total,
      paginationOptions: { page, limit },
    });
  }
}
