import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';
import type {
  IdentityProviderPort,
  TenantUser,
} from '../../ports/identity-provider.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { ListOrganizationUsersHandler } from './list-organization-users.handler';
import { ListOrganizationUsersQuery } from './list-organization-users.query';

const DEMO_RECORD: TenantRecord = {
  id: 'id-a',
  slug: 'labo-lyon',
  displayName: 'PTS Lyon',
  databaseName: 'minuseek_labo_lyon',
  identityProviderRealm: 'minuseek-labo-lyon',
};

const USERS: TenantUser[] = [
  {
    id: 'u1',
    username: 'chef',
    email: 'chef@lyon.fr',
    enabled: true,
    emailVerified: true,
  },
];

function build(record: TenantRecord | null) {
  const listedRealms: string[] = [];
  const registry = {
    findBySlug: () => Promise.resolve(record),
  } as unknown as TenantRegistryService;
  const identityProvider = {
    listUsers: (realm: string) => {
      listedRealms.push(realm);
      return Promise.resolve(USERS);
    },
  } as unknown as IdentityProviderPort;
  return {
    handler: new ListOrganizationUsersHandler(registry, identityProvider),
    listedRealms,
  };
}

describe('ListOrganizationUsersHandler', () => {
  it('liste les users du realm résolu depuis le registre (isolation)', async () => {
    const { handler, listedRealms } = build(DEMO_RECORD);

    const users = await handler.execute(
      new ListOrganizationUsersQuery('labo-lyon'),
    );

    expect(users).toEqual(USERS);
    // Le realm interrogé vient du registre, pas d'une entrée arbitraire.
    expect(listedRealms).toEqual(['minuseek-labo-lyon']);
  });

  it('rejette une organisation inconnue (404)', async () => {
    const { handler, listedRealms } = build(null);

    await expect(
      handler.execute(new ListOrganizationUsersQuery('intrus')),
    ).rejects.toThrow(OrganizationNotFoundError);
    expect(listedRealms).toEqual([]);
  });
});
