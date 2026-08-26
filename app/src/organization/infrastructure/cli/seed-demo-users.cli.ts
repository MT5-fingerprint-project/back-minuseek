import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SharedModule } from '../../../shared/shared.module';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import { IdentityAccessModule } from '../../../identity-access/identity-access.module';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { OrganizationModule } from '../../organization.module';
import { CreateOrganizationUserCommand } from '../../application/commands/create-organization-user/create-organization-user.command';
import { CreateOrganizationUserHandler } from '../../application/commands/create-organization-user/create-organization-user.handler';
import {
  OrganizationNotFoundError,
  OrganizationUserConflictError,
} from '../../application/organization.errors';

/**
 * Seed de développement : ajoute un responsable et trois utilisateurs de démo à l'organisation.
 *
 * Usage :
 *   pnpm ts-node src/organization/infrastructure/cli/seed-demo-users.cli.ts [slug]
 */
@Module({
  imports: [
    SharedModule,
    TenancyModule,
    OrganizationModule,
    IdentityAccessModule,
  ],
})
class SeedCliModule {}

const DEFAULT_SLUG = 'tenant-demo';
const EMAIL_DOMAIN = 'minuseek.local';

type DemoUser = {
  login: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRoleEnum;
  grade: string;
  serviceNumber: string;
};

/** Le nom d'utilisateur Keycloak est dérivé du préfixe de l'adresse : le login
 * annoncé ici est donc celui de la mire de connexion. */
const DEMO_USERS: DemoUser[] = [
  {
    login: 'responsable',
    password: 'responsable',
    firstName: 'Claire',
    lastName: 'Fabre',
    role: UserRoleEnum.ADMIN,
    grade: 'Commandant',
    serviceNumber: 'PTS-0001',
  },
  {
    login: 'operateur1',
    password: 'operateur1',
    firstName: 'Julien',
    lastName: 'Marchand',
    role: UserRoleEnum.OPERATOR,
    grade: 'Technicien principal',
    serviceNumber: 'PTS-0002',
  },
  {
    login: 'operateur2',
    password: 'operateur2',
    firstName: 'Nadia',
    lastName: 'Belkacem',
    role: UserRoleEnum.OPERATOR,
    grade: 'Technicien',
    serviceNumber: 'PTS-0003',
  },
  {
    login: 'operateur3',
    password: 'operateur3',
    firstName: 'Thomas',
    lastName: 'Rivière',
    role: UserRoleEnum.OPERATOR,
    grade: 'Technicien',
    serviceNumber: 'PTS-0004',
  },
];

function emailOf(user: DemoUser): string {
  return `${user.login}@${EMAIL_DOMAIN}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const slug = process.argv[2] ?? DEFAULT_SLUG;

  const applicationContext = await NestFactory.createApplicationContext(
    SeedCliModule,
    { logger: ['error', 'warn'] },
  );
  try {
    const record = await applicationContext
      .get(TenantRegistryService)
      .findBySlug(slug);
    if (!record) {
      throw new OrganizationNotFoundError(slug);
    }

    const handler = applicationContext.get(CreateOrganizationUserHandler);
    const token = await keycloakAdminToken();

    for (const user of DEMO_USERS) {
      const created = await register(handler, slug, user);
      await forceKnownPassword(token, record.identityProviderRealm, user);
      console.log(
        `${created ? '+' : '='} ${user.login} (${user.role}, ${user.serviceNumber})`,
      );
    }

    console.log(`\nComptes de dev sur ${slug} — mot de passe = identifiant :`);
    for (const user of DEMO_USERS) {
      console.log(`  ${user.login} / ${user.password}`);
    }
  } finally {
    await applicationContext.close();
  }
}

/** Rend vrai quand le compte a été posé par cet appel, faux s'il était déjà là :
 * le seed doit pouvoir se rejouer sans rien casser. */
async function register(
  handler: CreateOrganizationUserHandler,
  slug: string,
  user: DemoUser,
): Promise<boolean> {
  try {
    await handler.execute(
      new CreateOrganizationUserCommand(
        slug,
        emailOf(user),
        user.firstName,
        user.lastName,
        user.role,
        user.grade,
        user.serviceNumber,
      ),
    );
    return true;
  } catch (error) {
    if (error instanceof OrganizationUserConflictError) {
      return false;
    }
    throw error;
  }
}

async function keycloakAdminToken(): Promise<string> {
  const response = await fetch(
    `${requireEnv('KEYCLOAK_INTERNAL_URL')}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: requireEnv('KEYCLOAK_ADMIN_CLIENT_ID'),
        client_secret: requireEnv('KEYCLOAK_ADMIN_CLIENT_SECRET'),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Keycloak a refusé le jeton d'administration (${response.status})`,
    );
  }
  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Keycloak n'a rendu aucun jeton d'administration");
  }
  return payload.access_token;
}

/** Remplace le mot de passe temporaire par un mot de passe connu et lève
 * l'action « changer le mot de passe » : sans ça, chaque connexion de démo
 * commence par un formulaire de changement. */
async function forceKnownPassword(
  token: string,
  realm: string,
  user: DemoUser,
): Promise<void> {
  const base = `${requireEnv('KEYCLOAK_INTERNAL_URL')}/admin/realms/${realm}/users`;
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const search = await fetch(
    `${base}?email=${encodeURIComponent(emailOf(user))}&exact=true`,
    { headers },
  );
  const [account] = (await search.json()) as Array<{ id?: string }>;
  if (!account?.id) {
    throw new Error(`Compte introuvable dans ${realm} : ${emailOf(user)}`);
  }

  const reset = await fetch(`${base}/${account.id}/reset-password`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      type: 'password',
      value: user.password,
      temporary: false,
    }),
  });
  if (!reset.ok) {
    throw new Error(`Mot de passe refusé pour ${user.login} (${reset.status})`);
  }

  const clear = await fetch(`${base}/${account.id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ requiredActions: [] }),
  });
  if (!clear.ok) {
    throw new Error(
      `Actions requises non levées pour ${user.login} (${clear.status})`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
