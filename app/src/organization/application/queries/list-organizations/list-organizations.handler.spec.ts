import type {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';
import { ListOrganizationsHandler } from './list-organizations.handler';

const RECORDS: TenantRecord[] = [
  {
    id: 'id-a',
    slug: 'labo-lyon',
    displayName: 'PTS Lyon',
    databaseName: 'minuseek_labo_lyon',
    identityProviderRealm: 'minuseek-labo-lyon',
  },
];

describe('ListOrganizationsHandler', () => {
  it('renvoie la liste du registre', async () => {
    const registry = {
      list: () => Promise.resolve(RECORDS),
    } as unknown as TenantRegistryService;
    const handler = new ListOrganizationsHandler(registry);

    await expect(handler.execute()).resolves.toEqual(RECORDS);
  });
});
