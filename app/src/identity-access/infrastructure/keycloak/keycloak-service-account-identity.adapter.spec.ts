import type {
  IdentityProviderPort,
  UpdateUserInput,
} from '../../../organization/application/ports/identity-provider.port';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import {
  NoTenantInContextError,
  TenantUnavailableError,
} from '../../../tenancy/application/tenancy.errors';
import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../tenancy/application/tenant-registry.service';
import { IdentityProviderUnavailableError } from '../../application/ports/identity-provider-unavailable.error';
import { KeycloakServiceAccountIdentityAdapter } from './keycloak-service-account-identity.adapter';

class RecordingIdentityProvider {
  readonly updated: Array<{
    realm: string;
    userId: string;
    input: UpdateUserInput;
  }> = [];
  failure: Error | undefined;

  updateUser(
    realm: string,
    userId: string,
    input: UpdateUserInput,
  ): Promise<void> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.updated.push({ realm, userId, input });
    return Promise.resolve();
  }
}

const TENANTS: Record<string, TenantRecord> = {
  'tenant-a': {
    id: 'id-a',
    slug: 'tenant-a',
    displayName: 'PTS A',
    databaseName: 'minuseek_tenant_a',
    identityProviderRealm: 'minuseek-tenant-a',
  },
  'tenant-b': {
    id: 'id-b',
    slug: 'tenant-b',
    displayName: 'PTS B',
    databaseName: 'minuseek_tenant_b',
    identityProviderRealm: 'minuseek-tenant-b',
  },
};

function build() {
  const identityProvider = new RecordingIdentityProvider();
  const tenantContext = new TenantContextService();
  const registry = {
    findBySlug: (slug: string) => Promise.resolve(TENANTS[slug] ?? null),
  } as unknown as TenantRegistryService;
  return {
    adapter: new KeycloakServiceAccountIdentityAdapter(
      identityProvider as unknown as IdentityProviderPort,
      registry,
      tenantContext,
    ),
    identityProvider,
    tenantContext,
  };
}

describe('KeycloakServiceAccountIdentityAdapter', () => {
  it('désactive le compte dans le royaume du tenant courant', async () => {
    const { adapter, identityProvider, tenantContext } = build();

    await tenantContext.run({ slug: 'tenant-a' }, () =>
      adapter.setEnabled('kc-sub-1', false),
    );

    expect(identityProvider.updated).toEqual([
      {
        realm: 'minuseek-tenant-a',
        userId: 'kc-sub-1',
        input: { enabled: false },
      },
    ]);
  });

  it('réactive le compte', async () => {
    const { adapter, identityProvider, tenantContext } = build();

    await tenantContext.run({ slug: 'tenant-a' }, () =>
      adapter.setEnabled('kc-sub-1', true),
    );

    expect(identityProvider.updated[0].input).toEqual({ enabled: true });
  });

  it("renomme sans toucher à l'état du compte", async () => {
    const { adapter, identityProvider, tenantContext } = build();

    await tenantContext.run({ slug: 'tenant-a' }, () =>
      adapter.updateProfile('kc-sub-1', {
        firstName: 'Nadia',
        lastName: 'Belkacem',
      }),
    );

    expect(identityProvider.updated[0].input).toEqual({
      firstName: 'Nadia',
      lastName: 'Belkacem',
    });
  });

  it('ne vise que le royaume du tenant courant, jamais un autre du registre', async () => {
    const { adapter, identityProvider, tenantContext } = build();

    await tenantContext.run({ slug: 'tenant-b' }, () =>
      adapter.setEnabled('kc-sub-1', false),
    );

    expect(identityProvider.updated[0].realm).toBe('minuseek-tenant-b');
  });

  // L'adapter est un singleton Nest partagé par tous les tenants : mémoïser le
  // royaume ferait écrire le service suivant dans le royaume du précédent.
  it('résout le royaume à chaque appel, sans mémoriser celui du tenant précédent', async () => {
    const { adapter, identityProvider, tenantContext } = build();

    await tenantContext.run({ slug: 'tenant-a' }, () =>
      adapter.setEnabled('kc-sub-1', false),
    );
    await tenantContext.run({ slug: 'tenant-b' }, () =>
      adapter.setEnabled('kc-sub-2', false),
    );

    expect(identityProvider.updated.map((call) => call.realm)).toEqual([
      'minuseek-tenant-a',
      'minuseek-tenant-b',
    ]);
  });

  it('échoue hors de tout contexte tenant, sans appeler le fournisseur', async () => {
    const { adapter, identityProvider } = build();

    await expect(adapter.setEnabled('kc-sub-1', false)).rejects.toThrow(
      NoTenantInContextError,
    );
    expect(identityProvider.updated).toEqual([]);
  });

  it('échoue quand le registre ne connaît pas le slug, sans replier sur un royaume par défaut', async () => {
    const { adapter, identityProvider, tenantContext } = build();

    await expect(
      tenantContext.run({ slug: 'tenant-fantome' }, () =>
        adapter.setEnabled('kc-sub-1', false),
      ),
    ).rejects.toThrow(TenantUnavailableError);
    expect(identityProvider.updated).toEqual([]);
  });

  it("remonte l'échec du fournisseur d'identité au lieu de l'avaler", async () => {
    const { adapter, identityProvider, tenantContext } = build();
    identityProvider.failure = new Error('keycloak down');

    await expect(
      tenantContext.run({ slug: 'tenant-a' }, () =>
        adapter.setEnabled('kc-sub-1', false),
      ),
    ).rejects.toThrow(IdentityProviderUnavailableError);
  });

  it("conserve la cause de l'échec pour le journal", async () => {
    const { adapter, identityProvider, tenantContext } = build();
    const panne = new Error('keycloak down');
    identityProvider.failure = panne;

    const rejected = await tenantContext
      .run({ slug: 'tenant-a' }, () => adapter.setEnabled('kc-sub-1', false))
      .catch((error: unknown) => error);

    expect((rejected as Error).cause).toBe(panne);
  });
});
