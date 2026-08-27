import type {
  ServiceUserRole,
  ServiceUserRolesPort,
} from '../../application/ports/service-user-roles.port';

interface ServiceUserRoleRow extends ServiceUserRole {
  organizationSlug: string;
}

export class InMemoryServiceUserRolesReader implements ServiceUserRolesPort {
  readonly asked: {
    organizationSlug: string;
    identityProviderIds: string[];
  }[] = [];

  constructor(private readonly rows: ServiceUserRoleRow[] = []) {}

  findRolesOf(
    organizationSlug: string,
    identityProviderIds: string[],
  ): Promise<ServiceUserRole[]> {
    this.asked.push({ organizationSlug, identityProviderIds });
    return Promise.resolve(
      this.rows
        .filter(
          (row) =>
            row.organizationSlug === organizationSlug &&
            identityProviderIds.includes(row.identityProviderId),
        )
        .map(({ identityProviderId, role }) => ({ identityProviderId, role })),
    );
  }
}
