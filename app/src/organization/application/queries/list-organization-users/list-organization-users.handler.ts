import { Inject, Injectable } from '@nestjs/common';
import { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import {
  IDENTITY_PROVIDER,
  IdentityProviderPort,
  TenantUser,
} from '../../ports/identity-provider.port';
import {
  SERVICE_USER_ROLES,
  ServiceUserRolesPort,
} from '../../ports/service-user-roles.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { ListOrganizationUsersQuery } from './list-organization-users.query';
import { OrganizationUserReadModel } from './organization-user-read-model';
import { PageDto } from '../../../../shared/application/pagination/page.dto';

@Injectable()
export class ListOrganizationUsersHandler {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
    @Inject(SERVICE_USER_ROLES)
    private readonly serviceUserRoles: ServiceUserRolesPort,
  ) {}

  async execute(
    query: ListOrganizationUsersQuery,
  ): Promise<PageDto<OrganizationUserReadModel>> {
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

    return new PageDto(await this.withRoles(record.slug, items), {
      itemCount: total,
      paginationOptions: { page, limit },
    });
  }

  /** Une seule requête pour toute la page : l'identifiant que rend le
   * fournisseur d'identité est l'`identityProviderId` de la ligne en base. */
  private async withRoles(
    organizationSlug: string,
    accounts: TenantUser[],
  ): Promise<OrganizationUserReadModel[]> {
    if (accounts.length === 0) {
      return [];
    }

    const serviceUsers = await this.serviceUserRoles.findRolesOf(
      organizationSlug,
      accounts.map((account) => account.id),
    );
    const roleByIdentityProviderId = new Map(
      serviceUsers.map((serviceUser) => [
        serviceUser.identityProviderId,
        serviceUser.role,
      ]),
    );

    return accounts.map((account) => ({
      ...account,
      role: roleByIdentityProviderId.get(account.id) ?? null,
    }));
  }
}
