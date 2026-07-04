import type { AdminPrismaService } from '../infrastructure/persistence/admin-prisma.service';
import { TenantRegistryService, TenantRecord } from './tenant-registry.service';

const DEMO_RECORD: Omit<TenantRecord, 'id'> = {
  slug: 'labo-lyon',
  displayName: 'PTS Lyon',
  databaseName: 'minuseek_labo_lyon',
  identityProviderRealm: 'minuseek-labo-lyon',
};

/** Fake structurel du client admin : une Map en guise de table tenant. */
class InMemoryAdminPrisma {
  private readonly rows = new Map<string, TenantRecord>();

  findTenantBySlug(slug: string): Promise<TenantRecord | null> {
    return Promise.resolve(this.rows.get(slug) ?? null);
  }

  createTenant(record: Omit<TenantRecord, 'id'>): Promise<TenantRecord> {
    const created = { id: `id-${record.slug}`, ...record };
    this.rows.set(record.slug, created);
    return Promise.resolve(created);
  }
}

function buildRegistry() {
  return new TenantRegistryService(
    new InMemoryAdminPrisma() as unknown as AdminPrismaService,
  );
}

describe('TenantRegistryService.register', () => {
  it('insère le tenant et le rend immédiatement visible', async () => {
    const registry = buildRegistry();

    const created = await registry.register(DEMO_RECORD);

    expect(created.id).toBeDefined();
    await expect(registry.findBySlug('labo-lyon')).resolves.toMatchObject(
      DEMO_RECORD,
    );
  });

  it('purge le négatif en cache : un slug inconnu devient résolu après register', async () => {
    const registry = buildRegistry();

    // Miss AVANT provisioning : mis en cache négatif (TTL 10 s).
    await expect(registry.findBySlug('labo-lyon')).resolves.toBeNull();

    await registry.register(DEMO_RECORD);

    // Sans invalidate(), ce lookup renverrait encore le null en cache.
    await expect(registry.findBySlug('labo-lyon')).resolves.toMatchObject(
      DEMO_RECORD,
    );
  });
});
