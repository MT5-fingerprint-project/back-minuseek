import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateOrganizationUserHandler } from './application/commands/create-organization-user/create-organization-user.handler';
import { CreateOrganizationHandler } from './application/commands/create-organization/create-organization.handler';
import { DeleteOrganizationHandler } from './application/commands/delete-organization/delete-organization.handler';
import { DeleteOrganizationUserHandler } from './application/commands/delete-organization-user/delete-organization-user.handler';
import { IDENTITY_PROVIDER } from './application/ports/identity-provider.port';
import { ORGANIZATION_INITIALIZER } from './application/ports/organization-initializer.port';
import { TENANT_CONNECTION_CACHE } from './application/ports/tenant-connection-cache.port';
import { TENANT_DATABASE_ADMIN } from './application/ports/tenant-database.port';
import { SERVICE_USER_REGISTRAR } from './application/ports/service-user-registrar.port';
import { SERVICE_USER_ROLES } from './application/ports/service-user-roles.port';
import { ListOrganizationsHandler } from './application/queries/list-organizations/list-organizations.handler';
import { ListOrganizationUsersHandler } from './application/queries/list-organization-users/list-organization-users.handler';
import { OrganizationController } from './infrastructure/http/organization.controller';
import { KeycloakAdminService } from './infrastructure/keycloak/keycloak-admin.service';
import { OrganizationInitializer } from './infrastructure/persistence/organization.initializer';
import { TenantDatabaseAdminService } from './infrastructure/persistence/tenant-database-admin.service';
import { ServiceUserRegistrar } from './infrastructure/persistence/service-user.registrar';
import { ServiceUserRolesReader } from './infrastructure/persistence/service-user-roles.reader';
import { TenantConnectionService } from '../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

/**
 * Bounded context du control-plane (ADR-0004) : le cycle de vie des
 * organisations. Ses routes sont @SystemRealmOnly() — l'app admin est son
 * futur consommateur, le CLI de provisioning son consommateur d'amorçage.
 */
@Module({
  imports: [CqrsModule, AuditTrailModule],
  controllers: [OrganizationController],
  providers: [
    CreateOrganizationHandler,
    DeleteOrganizationHandler,
    ListOrganizationsHandler,
    ListOrganizationUsersHandler,
    CreateOrganizationUserHandler,
    DeleteOrganizationUserHandler,
    { provide: IDENTITY_PROVIDER, useClass: KeycloakAdminService },
    { provide: TENANT_DATABASE_ADMIN, useClass: TenantDatabaseAdminService },
    { provide: TENANT_CONNECTION_CACHE, useExisting: TenantConnectionService },
    { provide: ORGANIZATION_INITIALIZER, useClass: OrganizationInitializer },
    { provide: SERVICE_USER_REGISTRAR, useClass: ServiceUserRegistrar },
    { provide: SERVICE_USER_ROLES, useClass: ServiceUserRolesReader },
  ],
  exports: [CreateOrganizationHandler, IDENTITY_PROVIDER],
})
export class OrganizationModule {}
