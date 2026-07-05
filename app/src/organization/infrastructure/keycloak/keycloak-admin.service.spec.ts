import type KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { KeycloakAdminService } from './keycloak-admin.service';

class StubAdminClient {
  auth = jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined);
  realms = {
    findOne: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(null),
    create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
    del: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };
  clients = {
    find: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
    create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
  };
  users = {
    find: jest
      .fn<
        Promise<
          Array<{
            id?: string;
            username?: string;
            email?: string;
            enabled?: boolean;
            emailVerified?: boolean;
          }>
        >,
        [unknown]
      >()
      .mockResolvedValue([]),
    create: jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({ id: 'user-chef' }),
    count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(0),
    del: jest.fn<Promise<void>, [unknown]>().mockResolvedValue(undefined),
  };
}

class TestableKeycloakAdminService extends KeycloakAdminService {
  constructor(private readonly stub: StubAdminClient) {
    super();
  }

  protected override createAdminClient(): Promise<KeycloakAdminClient> {
    return Promise.resolve(this.stub as unknown as KeycloakAdminClient);
  }
}

function buildService() {
  process.env.KEYCLOAK_INTERNAL_URL = 'http://keycloak:8080';
  process.env.KEYCLOAK_ADMIN_CLIENT_ID = 'minuseek-provisioner';
  process.env.KEYCLOAK_ADMIN_CLIENT_SECRET = 'secret';
  process.env.ORIGIN =
    'https://app-dev.minuseek.fr,https://admin-dev.minuseek.fr';
  process.env.FRONT_ORIGIN = 'https://app-dev.minuseek.fr';
  const stub = new StubAdminClient();
  return { service: new TestableKeycloakAdminService(stub), stub };
}

describe('KeycloakAdminService', () => {
  it("s'authentifie en client_credentials avec le client provisioner", async () => {
    const { service, stub } = buildService();
    await service.ensureRealm('minuseek-labo-lyon', 'PTS Lyon');
    expect(stub.auth).toHaveBeenCalledWith({
      grantType: 'client_credentials',
      clientId: 'minuseek-provisioner',
      clientSecret: 'secret',
    });
  });

  it('crée le realm avec le template minuseek quand il est absent', async () => {
    const { service, stub } = buildService();
    await service.ensureRealm('minuseek-labo-lyon', 'PTS Lyon');

    expect(stub.realms.create).toHaveBeenCalledWith(
      expect.objectContaining({
        realm: 'minuseek-labo-lyon',
        displayName: 'PTS Lyon',
        loginTheme: 'minuseek',
        registrationAllowed: false,
        resetPasswordAllowed: true,
      }),
    );
  });

  it('crée le client front avec PKCE S256 et le mapper d’audience', async () => {
    const { service, stub } = buildService();
    await service.ensureRealm('minuseek-labo-lyon', 'PTS Lyon');

    expect(stub.clients.create).toHaveBeenCalledWith(
      expect.objectContaining({
        realm: 'minuseek-labo-lyon',
        clientId: 'front-minuseek',
        publicClient: true,
        redirectUris: ['https://app-dev.minuseek.fr/*'],
        attributes: expect.objectContaining({
          'pkce.code.challenge.method': 'S256',
        }) as object,
        protocolMappers: [
          expect.objectContaining({
            protocolMapper: 'oidc-audience-mapper',
            config: expect.objectContaining({
              'included.custom.audience': 'minuseek-api',
            }) as object,
          }),
        ],
      }),
    );
  });

  it('le redirect vient de FRONT_ORIGIN, indépendamment de l’ordre de ORIGIN', async () => {
    const { service, stub } = buildService();
    // Console admin en tête de la liste CORS : le redirect ne doit PAS la prendre.
    process.env.ORIGIN = 'http://localhost:5174,http://localhost:5173';
    process.env.FRONT_ORIGIN = 'http://localhost:5173';
    await service.ensureRealm('minuseek-labo-lyon', 'PTS Lyon');

    expect(stub.clients.create).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUris: ['http://localhost:5173/*'],
        webOrigins: ['http://localhost:5173'],
      }),
    );
  });

  it('ne recrée ni realm ni client déjà présents (rejeu de saga)', async () => {
    const { service, stub } = buildService();
    stub.realms.findOne.mockResolvedValue({ realm: 'minuseek-labo-lyon' });
    stub.clients.find.mockResolvedValue([{ clientId: 'front-minuseek' }]);

    await service.ensureRealm('minuseek-labo-lyon', 'PTS Lyon');

    expect(stub.realms.create).not.toHaveBeenCalled();
    expect(stub.clients.create).not.toHaveBeenCalled();
  });

  it('crée un utilisateur avec mot de passe temporaire à changer au premier login', async () => {
    const { service, stub } = buildService();
    const created = await service.createUser('minuseek-labo-lyon', {
      email: 'chef@lyon.fr',
    });

    expect(created.id).toBe('user-chef');
    expect(created.username).toBe('chef');
    expect(created.email).toBe('chef@lyon.fr');
    expect(created.temporaryPassword).toEqual(expect.any(String));
    expect(stub.users.create).toHaveBeenCalledWith(
      expect.objectContaining({
        realm: 'minuseek-labo-lyon',
        email: 'chef@lyon.fr',
        credentials: [
          expect.objectContaining({ type: 'password', temporary: true }),
        ],
        requiredActions: ['UPDATE_PASSWORD'],
      }),
    );
  });

  it('ne recrée pas un utilisateur existant et ne renvoie aucun mot de passe', async () => {
    const { service, stub } = buildService();
    stub.users.find.mockResolvedValue([
      {
        id: 'user-chef',
        username: 'chef',
        email: 'chef@lyon.fr',
        enabled: true,
        emailVerified: true,
      },
    ]);

    const created = await service.createUser('minuseek-labo-lyon', {
      email: 'chef@lyon.fr',
    });

    expect(created).toEqual({
      id: 'user-chef',
      username: 'chef',
      email: 'chef@lyon.fr',
      enabled: true,
      emailVerified: true,
      temporaryPassword: null,
    });
    expect(stub.users.create).not.toHaveBeenCalled();
  });

  it('liste les utilisateurs du realm tenant', async () => {
    const { service, stub } = buildService();
    stub.users.find.mockResolvedValue([
      {
        id: 'user-chef',
        username: 'chef',
        email: 'chef@lyon.fr',
        enabled: true,
        emailVerified: true,
      },
    ]);
    stub.users.count.mockResolvedValue(1);

    await expect(
      service.listUsers('minuseek-labo-lyon', { first: 0, max: 20 }),
    ).resolves.toEqual({
      items: [
        {
          id: 'user-chef',
          username: 'chef',
          email: 'chef@lyon.fr',
          enabled: true,
          emailVerified: true,
        },
      ],
      total: 1,
    });
    expect(stub.users.find).toHaveBeenCalledWith({
      realm: 'minuseek-labo-lyon',
      first: 0,
      max: 20,
    });
    expect(stub.users.count).toHaveBeenCalledWith({
      realm: 'minuseek-labo-lyon',
    });
  });

  it('absorbe la suppression d’un utilisateur déjà absent', async () => {
    const { service, stub } = buildService();
    stub.users.del.mockRejectedValue(new Error('404'));
    await expect(
      service.deleteUser('minuseek-labo-lyon', 'user-chef'),
    ).resolves.toBeUndefined();
  });

  it('absorbe la suppression d’un realm déjà absent (compensation)', async () => {
    const { service, stub } = buildService();
    stub.realms.del.mockRejectedValue(new Error('404'));
    await expect(
      service.deleteRealm('minuseek-labo-lyon'),
    ).resolves.toBeUndefined();
  });
});
