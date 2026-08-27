import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import type {
  ServiceUserRole,
  ServiceUserRolesPort,
} from '../../application/ports/service-user-roles.port';

@Injectable()
export class ServiceUserRolesReader implements ServiceUserRolesPort {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findRolesOf(
    organizationSlug: string,
    identityProviderIds: string[],
  ): Promise<ServiceUserRole[]> {
    if (identityProviderIds.length === 0) {
      return [];
    }

    // Accès explicite par slug : sur le control-plane, la requête arrive du
    // royaume système et aucun tenant courant n'est ouvert.
    const prisma = await this.tenantConnection.getClient(organizationSlug);
    const rows = await prisma.user.findMany({
      where: { identityProviderId: { in: identityProviderIds } },
      select: { identityProviderId: true, role: true },
    });

    return rows.map((row) => ({
      identityProviderId: row.identityProviderId,
      role: row.role,
    }));
  }
}
