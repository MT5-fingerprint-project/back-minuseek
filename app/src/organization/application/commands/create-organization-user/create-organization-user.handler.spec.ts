import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';
import type {
  CreatedUser,
  CreateUserInput,
  IdentityProviderPort,
} from '../../ports/identity-provider.port';
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

function build(record: TenantRecord | null) {
  const calls: Array<{ realm: string; input: CreateUserInput }> = [];
  const registry = {
    findBySlug: () => Promise.resolve(record),
  } as unknown as TenantRegistryService;
  const identityProvider = {
    createUser: (realm: string, input: CreateUserInput) => {
      calls.push({ realm, input });
      return Promise.resolve({
        id: 'u1',
        username: input.email.split('@')[0],
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        enabled: true,
        emailVerified: true,
        temporaryPassword: 'tmp',
      } satisfies CreatedUser);
    },
  } as unknown as IdentityProviderPort;
  return {
    handler: new CreateOrganizationUserHandler(registry, identityProvider),
    calls,
  };
}

describe('CreateOrganizationUserHandler', () => {
  it('crée l’utilisateur dans le realm résolu depuis le registre', async () => {
    const { handler, calls } = build(DEMO_RECORD);

    const created = await handler.execute(
      new CreateOrganizationUserCommand(
        'labo-lyon',
        'chef@lyon.fr',
        'Jean',
        'Dup',
      ),
    );

    expect(created.temporaryPassword).toBe('tmp');
    expect(calls).toEqual([
      {
        realm: 'minuseek-labo-lyon',
        input: { email: 'chef@lyon.fr', firstName: 'Jean', lastName: 'Dup' },
      },
    ]);
  });

  it('rejette une organisation inconnue (404) sans créer d’utilisateur', async () => {
    const { handler, calls } = build(null);

    await expect(
      handler.execute(new CreateOrganizationUserCommand('intrus', 'x@x.fr')),
    ).rejects.toThrow(OrganizationNotFoundError);
    expect(calls).toEqual([]);
  });
});
