import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';
import type {
  IdentityProviderPort,
  ListUsersInput,
  TenantUser,
} from '../../ports/identity-provider.port';
import { InMemoryServiceUserRolesReader } from '../../../infrastructure/persistence/in-memory-service-user-roles.reader';
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

const CHEF: TenantUser = {
  id: 'kc-chef',
  username: 'chef',
  email: 'chef@lyon.fr',
  enabled: true,
  emailVerified: true,
};

const TECHNICIENNE: TenantUser = {
  id: 'kc-marie',
  username: 'marie',
  email: 'marie@lyon.fr',
  enabled: true,
  emailVerified: true,
};

function build(
  record: TenantRecord | null,
  users: TenantUser[] = [CHEF],
  roles = new InMemoryServiceUserRolesReader([
    {
      organizationSlug: 'labo-lyon',
      identityProviderId: 'kc-chef',
      role: 'ADMIN',
    },
    {
      organizationSlug: 'labo-lyon',
      identityProviderId: 'kc-marie',
      role: 'OPERATOR',
    },
  ]),
) {
  const listedRealms: string[] = [];
  const pagesAsked: ListUsersInput[] = [];
  const registry = {
    findBySlug: () => Promise.resolve(record),
  } as unknown as TenantRegistryService;
  const identityProvider = {
    listUsers: (realm: string, input: ListUsersInput) => {
      listedRealms.push(realm);
      pagesAsked.push(input);
      return Promise.resolve({ items: users, total: users.length });
    },
  } as unknown as IdentityProviderPort;
  return {
    handler: new ListOrganizationUsersHandler(
      registry,
      identityProvider,
      roles,
    ),
    listedRealms,
    pagesAsked,
    roles,
  };
}

describe('ListOrganizationUsersHandler', () => {
  it('liste les users du realm résolu depuis le registre (isolation)', async () => {
    const { handler, listedRealms } = build(DEMO_RECORD);

    const page = await handler.execute(
      new ListOrganizationUsersQuery('labo-lyon'),
    );

    expect(page.data).toEqual([{ ...CHEF, role: 'ADMIN' }]);
    expect(page.meta).toEqual({
      page: 1,
      limit: 20,
      itemCount: 1,
      pageCount: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    });
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

  it('attache à chaque compte le rôle de sa ligne en base', async () => {
    const { handler } = build(DEMO_RECORD, [CHEF, TECHNICIENNE]);

    const page = await handler.execute(
      new ListOrganizationUsersQuery('labo-lyon'),
    );

    expect(page.data.map((compte) => [compte.id, compte.role])).toEqual([
      ['kc-chef', 'ADMIN'],
      ['kc-marie', 'OPERATOR'],
    ]);
  });

  it("garde dans la liste, sans rôle, un compte du fournisseur d'identité sans ligne en base", async () => {
    const inconnu: TenantUser = { ...TECHNICIENNE, id: 'kc-fantome' };
    const { handler } = build(DEMO_RECORD, [CHEF, inconnu]);

    const page = await handler.execute(
      new ListOrganizationUsersQuery('labo-lyon'),
    );

    expect(page.data).toHaveLength(2);
    expect(page.data[1]).toEqual({ ...inconnu, role: null });
  });

  it('ne demande les rôles que des comptes de la page courante, en une fois', async () => {
    const { handler, roles } = build(DEMO_RECORD, [CHEF, TECHNICIENNE]);

    await handler.execute(new ListOrganizationUsersQuery('labo-lyon', 3, 2));

    expect(roles.asked).toEqual([
      {
        organizationSlug: 'labo-lyon',
        identityProviderIds: ['kc-chef', 'kc-marie'],
      },
    ]);
  });

  it('lit les rôles dans la base du service, pas dans une base devinée du realm', async () => {
    const { handler, roles } = build(DEMO_RECORD);

    await handler.execute(new ListOrganizationUsersQuery('labo-lyon'));

    expect(roles.asked[0].organizationSlug).toBe(DEMO_RECORD.slug);
  });

  it("n'interroge pas la base du service quand la page est vide", async () => {
    const { handler, roles } = build(DEMO_RECORD, []);

    const page = await handler.execute(
      new ListOrganizationUsersQuery('labo-lyon'),
    );

    expect(page.data).toEqual([]);
    expect(roles.asked).toEqual([]);
  });
});
