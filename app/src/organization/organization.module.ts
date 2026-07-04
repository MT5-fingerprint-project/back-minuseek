import { Module } from '@nestjs/common';
import { CreateOrganizationHandler } from './application/commands/create-organization/create-organization.handler';
import { IDENTITY_PROVIDER } from './application/ports/identity-provider.port';
import { ORGANIZATION_INITIALIZER } from './application/ports/organization-initializer.port';
import { TENANT_DATABASE_ADMIN } from './application/ports/tenant-database.port';
import { OrganizationController } from './infrastructure/http/organization.controller';
import { KeycloakAdminService } from './infrastructure/keycloak/keycloak-admin.service';
import { OrganizationInitializer } from './infrastructure/persistence/organization.initializer';
import { TenantDatabaseAdminService } from './infrastructure/persistence/tenant-database-admin.service';

/**
 * Bounded context du control-plane (ADR-0004) : le cycle de vie des
 * organisations. Ses routes sont @SystemRealmOnly() — l'app admin est son
 * futur consommateur, le CLI de provisioning son consommateur d'amorçage.
 */
@Module({
  controllers: [OrganizationController],
  providers: [
    CreateOrganizationHandler,
    { provide: IDENTITY_PROVIDER, useClass: KeycloakAdminService },
    { provide: TENANT_DATABASE_ADMIN, useClass: TenantDatabaseAdminService },
    { provide: ORGANIZATION_INITIALIZER, useClass: OrganizationInitializer },
  ],
  exports: [CreateOrganizationHandler],
})
export class OrganizationModule {}
