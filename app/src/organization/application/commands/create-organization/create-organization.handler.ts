import { Inject, Injectable, Logger } from '@nestjs/common';
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
  ORGANIZATION_INITIALIZER,
  OrganizationInitializerPort,
} from '../../ports/organization-initializer.port';
import {
  InvalidOrganizationSlugError,
  OrganizationAlreadyExistsError,
} from '../../organization.errors';
import {
  CreateOrganizationCommand,
  ProvisionedOrganization,
} from './create-organization.command';

const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const RESERVED_SLUGS = ['master', 'system', 'admin', 'minuseek'];

@Injectable()
export class CreateOrganizationHandler {
  private readonly logger = new Logger(CreateOrganizationHandler.name);

  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
    @Inject(TENANT_DATABASE_ADMIN)
    private readonly databaseAdmin: TenantDatabaseAdminPort,
    @Inject(ORGANIZATION_INITIALIZER)
    private readonly organizationInitializer: OrganizationInitializerPort,
  ) {}

  async execute(
    command: CreateOrganizationCommand,
  ): Promise<ProvisionedOrganization> {
    const slug = command.slug;
    if (
      !ORGANIZATION_SLUG_PATTERN.test(slug) ||
      RESERVED_SLUGS.includes(slug)
    ) {
      throw new InvalidOrganizationSlugError(slug);
    }
    if (await this.tenantRegistry.findBySlug(slug)) {
      throw new OrganizationAlreadyExistsError(slug);
    }
    const databaseName = `minuseek_${slug.replace(/-/g, '_')}`;
    const realm = `minuseek-${slug}`;

    const compensations: Array<{ label: string; run: () => Promise<void> }> =
      [];
    try {
      const realmResult = await this.identityProvider.ensureRealm(
        realm,
        command.displayName,
      );
      if (realmResult.created) {
        compensations.push({
          label: `suppression du realm ${realm}`,
          run: () => this.identityProvider.deleteRealm(realm),
        });
      }

      const databaseResult =
        await this.databaseAdmin.ensureDatabase(databaseName);
      if (databaseResult.created) {
        compensations.push({
          label: `suppression de la base ${databaseName}`,
          run: () => this.databaseAdmin.dropDatabase(databaseName),
        });
      }

      await this.databaseAdmin.migrate(databaseName);
      await this.organizationInitializer.initialize(
        databaseName,
        slug,
        command.displayName,
      );

      const created = await this.tenantRegistry.register({
        slug,
        displayName: command.displayName,
        databaseName,
        identityProviderRealm: realm,
      });

      return { ...created, realm };
    } catch (error) {
      await this.compensate(compensations);
      throw error;
    }
  }

  /** Défait les étapes réussies en ordre inverse. Un échec de compensation
   * n'est pas bloquant : les étapes étant idempotentes, un retry du
   * provisioning converge. */
  private async compensate(
    compensations: Array<{ label: string; run: () => Promise<void> }>,
  ): Promise<void> {
    for (const compensation of compensations.reverse()) {
      try {
        await compensation.run();
      } catch (compensationError) {
        this.logger.warn(
          `Compensation en échec (${compensation.label}): ${String(compensationError)}`,
        );
      }
    }
  }
}
