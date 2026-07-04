import { Inject, Injectable } from '@nestjs/common';
import { TenantRegistryService } from '../../../../tenancy/application/tenant-registry.service';
import {
  IDENTITY_PROVIDER,
  IdentityProviderPort,
} from '../../ports/identity-provider.port';
import {
  TENANT_DATABASE_ADMIN,
  TenantDatabaseAdminPort,
} from '../../ports/tenant-database.port';
import {
  TENANT_CONNECTION_CACHE,
  TenantConnectionCachePort,
} from '../../ports/tenant-connection-cache.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { DeleteOrganizationCommand } from './delete-organization.command';

@Injectable()
export class DeleteOrganizationHandler {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
    @Inject(TENANT_DATABASE_ADMIN)
    private readonly databaseAdmin: TenantDatabaseAdminPort,
    @Inject(TENANT_CONNECTION_CACHE)
    private readonly tenantConnectionCache: TenantConnectionCachePort,
  ) {}

  async execute(command: DeleteOrganizationCommand): Promise<void> {
    const record = await this.tenantRegistry.findBySlug(command.slug);
    if (!record) {
      throw new OrganizationNotFoundError(command.slug);
    }

    await this.tenantRegistry.delete(record.slug);
    await this.tenantConnectionCache.evict(record.slug);
    await this.identityProvider.deleteRealm(record.identityProviderRealm);
    await this.databaseAdmin.dropDatabase(record.databaseName);
  }
}
