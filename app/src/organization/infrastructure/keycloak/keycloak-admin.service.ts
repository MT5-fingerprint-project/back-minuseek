import { Injectable } from '@nestjs/common';
import type KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { randomBytes } from 'node:crypto';
import {
  CreateUserInput,
  CreatedUser,
  EnsureResult,
  IdentityProviderPort,
  TenantUser,
} from '../../application/ports/identity-provider.port';

const FRONT_CLIENT_ID = 'front-minuseek';
const API_AUDIENCE = 'minuseek-api';
const LOGIN_THEME = 'minuseek';
const ACCESS_TOKEN_LIFESPAN_SECONDS = 300;

@Injectable()
export class KeycloakAdminService implements IdentityProviderPort {
  private adminClient: KeycloakAdminClient | undefined;

  async ensureRealm(realm: string, displayName: string): Promise<EnsureResult> {
    const client = await this.authenticatedClient();
    const existing = await client.realms.findOne({ realm }).catch(() => null);
    const created = !existing;
    if (created) {
      await client.realms.create({
        realm,
        displayName,
        enabled: true,
        loginTheme: LOGIN_THEME,
        resetPasswordAllowed: true,
        registrationAllowed: false,
        accessTokenLifespan: ACCESS_TOKEN_LIFESPAN_SECONDS,
        bruteForceProtected: true,
        sslRequired: process.env.KEYCLOAK_REALM_SSL_REQUIRED ?? 'external',
      });
      await this.authenticatedClient();
    }
    await this.ensureFrontClient(realm);
    return { created };
  }

  async deleteRealm(realm: string): Promise<void> {
    const client = await this.authenticatedClient();
    await client.realms.del({ realm }).catch(() => undefined);
  }

  async listUsers(realm: string): Promise<TenantUser[]> {
    const client = await this.authenticatedClient();
    const users = await client.users.find({ realm });
    return users.map(toTenantUser);
  }

  async createUser(
    realm: string,
    input: CreateUserInput,
  ): Promise<CreatedUser> {
    const client = await this.authenticatedClient();
    const [existing] = await client.users.find({
      realm,
      email: input.email,
      exact: true,
    });
    if (existing?.username) {
      return { ...toTenantUser(existing), temporaryPassword: null };
    }

    const username = input.email.split('@')[0];
    const temporaryPassword = randomBytes(9).toString('base64url');
    const created = await client.users.create({
      realm,
      username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      emailVerified: true,
      enabled: true,
      credentials: [
        { type: 'password', value: temporaryPassword, temporary: true },
      ],
      requiredActions: ['UPDATE_PASSWORD'],
    });
    return {
      id: readCreatedUserId(created) ?? username,
      username,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      enabled: true,
      emailVerified: true,
      temporaryPassword,
    };
  }

  async deleteUser(realm: string, userId: string): Promise<void> {
    const client = await this.authenticatedClient();
    await client.users.del({ realm, id: userId }).catch(() => undefined);
  }

  private async ensureFrontClient(realm: string): Promise<void> {
    const client = await this.authenticatedClient();
    const found = await client.clients.find({
      realm,
      clientId: FRONT_CLIENT_ID,
    });
    if (found.length > 0) {
      return;
    }

    // Le redirect du client tenant vise UNIQUEMENT le front métier. C'est un env
    // dédié, distinct de la liste CORS ORIGIN (qui inclut aussi la console admin) :
    // on ne veut pas coupler ce redirect à l'ordre des origines CORS.
    const frontOrigin = requireEnv('FRONT_ORIGIN');
    await client.clients.create({
      realm,
      clientId: FRONT_CLIENT_ID,
      protocol: 'openid-connect',
      publicClient: true,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      redirectUris: [`${frontOrigin}/*`],
      webOrigins: [frontOrigin],
      attributes: {
        'pkce.code.challenge.method': 'S256',
        'post.logout.redirect.uris': '+',
      },
      protocolMappers: [
        {
          name: 'minuseek-api-audience',
          protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper',
          config: {
            'included.custom.audience': API_AUDIENCE,
            'access.token.claim': 'true',
            'id.token.claim': 'false',
          },
        },
      ],
    });
  }

  private async authenticatedClient(): Promise<KeycloakAdminClient> {
    this.adminClient ??= await this.createAdminClient();
    await this.adminClient.auth({
      grantType: 'client_credentials',
      clientId: requireEnv('KEYCLOAK_ADMIN_CLIENT_ID'),
      clientSecret: requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET'),
    });
    return this.adminClient;
  }

  protected async createAdminClient(): Promise<KeycloakAdminClient> {
    const { default: AdminClient } =
      await import('@keycloak/keycloak-admin-client');
    return new AdminClient({
      baseUrl: requireEnv('KEYCLOAK_INTERNAL_URL'),
      realmName: 'master',
    });
  }
}

type KeycloakUserLike = {
  id?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
};

function toTenantUser(user: KeycloakUserLike): TenantUser {
  const id = user.id ?? user.username ?? user.email ?? '';
  const username = user.username ?? user.email ?? id;
  return {
    id,
    username,
    email: user.email ?? username,
    firstName: user.firstName,
    lastName: user.lastName,
    enabled: user.enabled ?? false,
    emailVerified: user.emailVerified ?? false,
  };
}

function readCreatedUserId(created: unknown): string | null {
  if (
    typeof created === 'object' &&
    created !== null &&
    'id' in created &&
    typeof created.id === 'string'
  ) {
    return created.id;
  }
  return null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}
