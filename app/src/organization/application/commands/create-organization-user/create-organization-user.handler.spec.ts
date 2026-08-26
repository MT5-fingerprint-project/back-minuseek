import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';
import type {
  CreateUserInput,
  CreatedUser,
  IdentityProviderPort,
  ListedUsers,
} from '../../ports/identity-provider.port';
import type {
  ServiceUserRegistrarPort,
  ServiceUserToRegister,
} from '../../ports/service-user-registrar.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { CreateOrganizationUserHandler } from './create-organization-user.handler';
import { CreateOrganizationUserCommand } from './create-organization-user.command';

const DEMO_RECORD: TenantRecord = {
  id: 'id-a',
  slug: 'labo-lyon',
  displayName: 'PTS Lyon',
  databaseName: 'minuseek_labo_lyon',
  identityProviderRealm: 'minuseek-labo-lyon',
};

class InMemoryIdentityProvider implements IdentityProviderPort {
  readonly created: Array<{ realm: string; input: CreateUserInput }> = [];
  readonly deleted: Array<{ realm: string; userId: string }> = [];
  readonly preexistingEmails = new Set<string>();
  deletionFailure: Error | null = null;

  ensureRealm(): Promise<{ created: boolean }> {
    return Promise.resolve({ created: false });
  }

  deleteRealm(): Promise<void> {
    return Promise.resolve();
  }

  listUsers(): Promise<ListedUsers> {
    return Promise.resolve({ items: [], total: 0 });
  }

  createUser(realm: string, input: CreateUserInput): Promise<CreatedUser> {
    this.created.push({ realm, input });
    const username = input.email.split('@')[0];
    const preexisting = this.preexistingEmails.has(input.email);
    return Promise.resolve({
      id: `kc-${username}`,
      username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
      emailVerified: true,
      temporaryPassword: preexisting ? null : 'tmp-secret',
      created: !preexisting,
    });
  }

  deleteUser(realm: string, userId: string): Promise<void> {
    if (this.deletionFailure) {
      return Promise.reject(this.deletionFailure);
    }
    this.deleted.push({ realm, userId });
    return Promise.resolve();
  }
}

class InMemoryServiceUserRegistrar implements ServiceUserRegistrarPort {
  readonly registered: ServiceUserToRegister[] = [];
  failure: Error | null = null;

  register(user: ServiceUserToRegister): Promise<void> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.registered.push(user);
    return Promise.resolve();
  }
}

function build(record: TenantRecord | null) {
  const registry = {
    findBySlug: () => Promise.resolve(record),
  } as unknown as TenantRegistryService;
  const identityProvider = new InMemoryIdentityProvider();
  const registrar = new InMemoryServiceUserRegistrar();
  return {
    handler: new CreateOrganizationUserHandler(
      registry,
      identityProvider,
      registrar,
    ),
    identityProvider,
    registrar,
  };
}

const command = (overrides: Partial<CreateOrganizationUserCommand> = {}) =>
  new CreateOrganizationUserCommand(
    overrides.organizationSlug ?? 'labo-lyon',
    overrides.email ?? 'chef@lyon.fr',
    overrides.firstName ?? 'Jean',
    overrides.lastName ?? 'Dupont',
    overrides.role ?? 'OPERATOR',
    overrides.grade ?? 'Capitaine',
    overrides.serviceNumber ?? 'SN-4212',
  );

describe('CreateOrganizationUserHandler', () => {
  it('crée le compte d’identité puis la ligne du service dans la même opération', async () => {
    const { handler, identityProvider, registrar } = build(DEMO_RECORD);

    const created = await handler.execute(command());

    expect(created.temporaryPassword).toBe('tmp-secret');
    expect(identityProvider.created).toEqual([
      {
        realm: 'minuseek-labo-lyon',
        input: {
          email: 'chef@lyon.fr',
          firstName: 'Jean',
          lastName: 'Dupont',
        },
      },
    ]);
    expect(registrar.registered).toEqual([
      {
        organizationSlug: 'labo-lyon',
        identityProviderId: 'kc-chef',
        role: 'OPERATOR',
        grade: 'Capitaine',
        serviceNumber: 'SN-4212',
        firstName: 'Jean',
        lastName: 'Dupont',
      },
    ]);
    expect(identityProvider.deleted).toEqual([]);
  });

  it('rejette une organisation inconnue (404) sans créer d’utilisateur', async () => {
    const { handler, identityProvider, registrar } = build(null);

    await expect(
      handler.execute(command({ organizationSlug: 'intrus' })),
    ).rejects.toThrow(OrganizationNotFoundError);
    expect(identityProvider.created).toEqual([]);
    expect(registrar.registered).toEqual([]);
  });

  it('supprime le compte d’identité créé quand l’écriture en base échoue', async () => {
    const { handler, identityProvider, registrar } = build(DEMO_RECORD);
    registrar.failure = new Error('base injoignable');

    await expect(handler.execute(command())).rejects.toThrow(
      'base injoignable',
    );
    expect(identityProvider.deleted).toEqual([
      { realm: 'minuseek-labo-lyon', userId: 'kc-chef' },
    ]);
  });

  it('ne supprime pas un compte d’identité qui préexistait à l’appel', async () => {
    const { handler, identityProvider, registrar } = build(DEMO_RECORD);
    identityProvider.preexistingEmails.add('chef@lyon.fr');
    registrar.failure = new Error('base injoignable');

    await expect(handler.execute(command())).rejects.toThrow(
      'base injoignable',
    );
    expect(identityProvider.deleted).toEqual([]);
  });

  it('enregistre la ligne du service même si le compte d’identité préexistait', async () => {
    const { handler, identityProvider, registrar } = build(DEMO_RECORD);
    identityProvider.preexistingEmails.add('chef@lyon.fr');

    const created = await handler.execute(command());

    expect(created.temporaryPassword).toBeNull();
    expect(registrar.registered).toHaveLength(1);
    expect(identityProvider.deleted).toEqual([]);
  });

  it('relève l’erreur d’origine même si la suppression compensatoire échoue', async () => {
    const { handler, identityProvider, registrar } = build(DEMO_RECORD);
    registrar.failure = new Error('base injoignable');
    identityProvider.deletionFailure = new Error('keycloak injoignable');

    await expect(handler.execute(command())).rejects.toThrow(
      'base injoignable',
    );
    expect(identityProvider.deleted).toEqual([]);
    expect(registrar.registered).toEqual([]);
  });
});
