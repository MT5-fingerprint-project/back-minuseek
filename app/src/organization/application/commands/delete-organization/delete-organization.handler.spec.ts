import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';
import type { IdentityProviderPort } from '../../ports/identity-provider.port';
import type { TenantDatabaseAdminPort } from '../../ports/tenant-database.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { DeleteOrganizationHandler } from './delete-organization.handler';
import { DeleteOrganizationCommand } from './delete-organization.command';

const DEMO_RECORD: TenantRecord = {
  id: 'id-a',
  slug: 'labo-lyon',
  displayName: 'PTS Lyon',
  databaseName: 'minuseek_labo_lyon',
  identityProviderRealm: 'minuseek-labo-lyon',
};

function build(record: TenantRecord | null) {
  const calls: string[] = [];
  const registry = {
    findBySlug: () => Promise.resolve(record),
    delete: (slug: string) => {
      calls.push(`registry.delete:${slug}`);
      return Promise.resolve(record);
    },
  } as unknown as TenantRegistryService;
  const identityProvider = {
    deleteRealm: (realm: string) => {
      calls.push(`deleteRealm:${realm}`);
      return Promise.resolve();
    },
  } as unknown as IdentityProviderPort;
  const databaseAdmin = {
    dropDatabase: (db: string) => {
      calls.push(`dropDatabase:${db}`);
      return Promise.resolve();
    },
  } as unknown as TenantDatabaseAdminPort;
  const cache = {
    evict: (slug: string) => {
      calls.push(`evict:${slug}`);
      return Promise.resolve();
    },
  };
  return {
    handler: new DeleteOrganizationHandler(
      registry,
      identityProvider,
      databaseAdmin,
      cache,
    ),
    calls,
  };
}

describe('DeleteOrganizationHandler', () => {
  it('déréférence le tenant AVANT de détruire realm et base', async () => {
    const { handler, calls } = build(DEMO_RECORD);

    await handler.execute(new DeleteOrganizationCommand('labo-lyon'));

    // Registre retiré + client évincé d'abord (plus servi), puis destruction.
    expect(calls).toEqual([
      'registry.delete:labo-lyon',
      'evict:labo-lyon',
      'deleteRealm:minuseek-labo-lyon',
      'dropDatabase:minuseek_labo_lyon',
    ]);
  });

  it('rejette une organisation inconnue (404) sans rien détruire', async () => {
    const { handler, calls } = build(null);

    await expect(
      handler.execute(new DeleteOrganizationCommand('intrus')),
    ).rejects.toThrow(OrganizationNotFoundError);
    expect(calls).toEqual([]);
  });
});
