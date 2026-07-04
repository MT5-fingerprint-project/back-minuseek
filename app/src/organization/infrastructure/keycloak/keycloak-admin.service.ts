import { Injectable } from '@nestjs/common';
import type KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import { randomBytes } from 'node:crypto';
import {
  CreatedUser,
  EnsureResult,
  IdentityProviderPort,
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

  async createUser(realm: string, email: string): Promise<CreatedUser> {
    const client = await this.authenticatedClient();
    const [existing] = await client.users.find({ realm, email, exact: true });
    if (existing?.username) {
      return { username: existing.username, temporaryPassword: null };
    }

    const username = email.split('@')[0];
    const temporaryPassword = randomBytes(9).toString('base64url');
    await client.users.create({
      realm,
      username,
      email,
      emailVerified: true,
      enabled: true,
      credentials: [
        { type: 'password', value: temporaryPassword, temporary: true },
      ],
      requiredActions: ['UPDATE_PASSWORD'],
    });
    return { username, temporaryPassword };
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

    const appOrigin = requireEnv('ORIGIN');
    await client.clients.create({
      realm,
      clientId: FRONT_CLIENT_ID,
      protocol: 'openid-connect',
      publicClient: true,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: false,
      serviceAccountsEnabled: false,
      redirectUris: [`${appOrigin}/*`],
      webOrigins: [appOrigin],
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}
