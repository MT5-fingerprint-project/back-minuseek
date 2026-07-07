import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';
import type { IdentityProviderPort } from '../../ports/identity-provider.port';
import { OrganizationNotFoundError } from '../../organization.errors';
import { DeleteOrganizationUserHandler } from './delete-organization-user.handler';
import { DeleteOrganizationUserCommand } from './delete-organization-user.command';

const DEMO_RECORD: TenantRecord = {
  id: 'id-a',
  slug: 'labo-lyon',
  displayName: 'PTS Lyon',
  databaseName: 'minuseek_labo_lyon',
  identityProviderRealm: 'minuseek-labo-lyon',
};

function build(record: TenantRecord | null) {
  const calls: Array<{ realm: string; userId: string }> = [];
  const registry = {
    findBySlug: () => Promise.resolve(record),
  } as unknown as TenantRegistryService;
  const identityProvider = {
    deleteUser: (realm: string, userId: string) => {
      calls.push({ realm, userId });
      return Promise.resolve();
    },
  } as unknown as IdentityProviderPort;
  return {
    handler: new DeleteOrganizationUserHandler(registry, identityProvider),
    calls,
  };
}

describe('DeleteOrganizationUserHandler', () => {
  it('supprime l’utilisateur dans le realm résolu depuis le registre', async () => {
    const { handler, calls } = build(DEMO_RECORD);

    await handler.execute(new DeleteOrganizationUserCommand('labo-lyon', 'u1'));

    expect(calls).toEqual([{ realm: 'minuseek-labo-lyon', userId: 'u1' }]);
  });

  it('rejette une organisation inconnue (404) sans rien supprimer', async () => {
    const { handler, calls } = build(null);

    await expect(
      handler.execute(new DeleteOrganizationUserCommand('intrus', 'u1')),
    ).rejects.toThrow(OrganizationNotFoundError);
    expect(calls).toEqual([]);
  });
});
