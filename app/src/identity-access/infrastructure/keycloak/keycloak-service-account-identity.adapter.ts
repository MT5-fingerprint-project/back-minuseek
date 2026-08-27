import { Inject, Injectable } from '@nestjs/common';
import {
  IDENTITY_PROVIDER,
  IdentityProviderPort,
  UpdateUserInput,
} from '../../../organization/application/ports/identity-provider.port';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import {
  NoTenantInContextError,
  TenantUnavailableError,
} from '../../../tenancy/application/tenancy.errors';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import { IdentityProviderUnavailableError } from '../../application/ports/identity-provider-unavailable.error';
import type {
  ServiceAccountIdentityPort,
  ServiceAccountProfile,
} from '../../application/ports/service-account-identity.port';

/**
 * Seul fichier d'identity-access qui parle au control-plane : le fournisseur
 * d'identité y est déjà câblé, et le dupliquer ferait un second client admin.
 */
@Injectable()
export class KeycloakServiceAccountIdentityAdapter implements ServiceAccountIdentityPort {
  constructor(
    @Inject(IDENTITY_PROVIDER)
    private readonly identityProvider: IdentityProviderPort,
    private readonly tenantRegistry: TenantRegistryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  setEnabled(identityProviderId: string, enabled: boolean): Promise<void> {
    return this.update(identityProviderId, { enabled });
  }

  updateProfile(
    identityProviderId: string,
    profile: ServiceAccountProfile,
  ): Promise<void> {
    return this.update(identityProviderId, {
      firstName: profile.firstName,
      lastName: profile.lastName,
    });
  }

  private async update(
    identityProviderId: string,
    input: UpdateUserInput,
  ): Promise<void> {
    const realm = await this.currentRealm();
    try {
      await this.identityProvider.updateUser(realm, identityProviderId, input);
    } catch (error) {
      throw new IdentityProviderUnavailableError(identityProviderId, error);
    }
  }

  private async currentRealm(): Promise<string> {
    const slug = this.tenantContext.getCurrentTenant();
    if (!slug) {
      throw new NoTenantInContextError();
    }
    const record = await this.tenantRegistry.findBySlug(slug);
    if (!record) {
      throw new TenantUnavailableError(slug);
    }
    return record.identityProviderRealm;
  }
}
