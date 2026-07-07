import type { PrismaClient } from '../../../../generated/prisma/client';
import type { Pool } from 'pg';
import {
  TenantRecord,
  TenantRegistryService,
} from '../../application/tenant-registry.service';
import { TenantContextService } from '../../application/tenant-context.service';
import {
  NoTenantInContextError,
  TenantUnavailableError,
} from '../../application/tenancy.errors';
import { TenantConnectionService } from './tenant-connection.service';

const DEMO_TENANT: TenantRecord = {
  id: '5f1e7c1a-0000-4000-8000-000000000001',
  slug: 'tenant-demo',
  displayName: 'Tenant démo',
  databaseName: 'minuseek',
  identityProviderRealm: 'minuseek-tenant-demo',
};

class InMemoryTenantRegistry {
  constructor(private readonly records: TenantRecord[]) {}

  findBySlug(slug: string): Promise<TenantRecord | null> {
    return Promise.resolve(
      this.records.find((record) => record.slug === slug) ?? null,
    );
  }

  invalidate(): void {}
}

/** Version testable : aucune vraie connexion, on compte les instanciations. */
class TestableTenantConnectionService extends TenantConnectionService {
  instantiationsByDb: string[] = [];
  disconnections: string[] = [];
  protected override readonly maxCachedClients = 2;

  protected override instantiateClient(
    record: TenantRecord,
  ): Promise<{ client: PrismaClient; pool: Pool }> {
    this.instantiationsByDb.push(record.databaseName);
    const client = {
      $disconnect: () => {
        this.disconnections.push(record.slug);
        return Promise.resolve();
      },
    } as unknown as PrismaClient;
    const pool = { end: () => Promise.resolve() } as unknown as Pool;
    return Promise.resolve({ client, pool });
  }
}

function buildService(records: TenantRecord[] = [DEMO_TENANT]) {
  process.env.TENANT_DATABASE_URL_TEMPLATE =
    'postgresql://minuseek:test@localhost:5432/{db}';
  return new TestableTenantConnectionService(
    new InMemoryTenantRegistry(records) as unknown as TenantRegistryService,
    new TenantContextService(),
  );
}

describe('TenantConnectionService', () => {
  it('résout le client du tenant courant depuis le contexte ambiant', async () => {
    const service = buildService();
    const tenantContext = new TenantContextService();

    const client = await tenantContext.run({ slug: 'tenant-demo' }, () =>
      service.getCurrentClient(),
    );

    expect(client).toBeDefined();
    expect(service.instantiationsByDb).toEqual(['minuseek']);
  });

  it('échoue fail-closed hors de tout contexte tenant', async () => {
    await expect(buildService().getCurrentClient()).rejects.toThrow(
      NoTenantInContextError,
    );
  });

  it('rejette un slug absent du registre', async () => {
    await expect(buildService().getClient('intrus')).rejects.toThrow(
      TenantUnavailableError,
    );
  });

  it('rejette un databaseName hors convention (défense en profondeur)', async () => {
    const service = buildService([
      { ...DEMO_TENANT, databaseName: 'minuseek;DROP DATABASE x' },
    ]);
    await expect(service.getClient('tenant-demo')).rejects.toThrow(
      TenantUnavailableError,
    );
    expect(service.instantiationsByDb).toEqual([]);
  });

  it('réutilise le client en cache pour un même tenant', async () => {
    const service = buildService();
    const first = await service.getClient('tenant-demo');
    const second = await service.getClient('tenant-demo');
    expect(second).toBe(first);
    expect(service.instantiationsByDb).toEqual(['minuseek']);
  });

  it('single-flight : deux miss concurrents ne créent qu’un seul client', async () => {
    const service = buildService();
    const [first, second] = await Promise.all([
      service.getClient('tenant-demo'),
      service.getClient('tenant-demo'),
    ]);
    expect(second).toBe(first);
    expect(service.instantiationsByDb).toEqual(['minuseek']);
  });

  it('evict ferme le client et force une re-création au prochain accès', async () => {
    const service = buildService();
    await service.getClient('tenant-demo');
    await service.evict('tenant-demo');
    expect(service.disconnections).toEqual(['tenant-demo']);

    await service.getClient('tenant-demo');
    expect(service.instantiationsByDb).toEqual(['minuseek', 'minuseek']);
  });

  it('évince le client le moins récemment utilisé quand le cache est plein', async () => {
    const tenants = ['a', 'b', 'c'].map((letter) => ({
      ...DEMO_TENANT,
      id: `${DEMO_TENANT.id.slice(0, -1)}${letter.charCodeAt(0)}`,
      slug: `tenant-${letter}`,
      databaseName: `minuseek_${letter}`,
      identityProviderRealm: `minuseek-tenant-${letter}`,
    }));
    const service = buildService(tenants);

    await service.getClient('tenant-a');
    await service.getClient('tenant-b'); // cache plein (max 2 en test)
    await service.getClient('tenant-a'); // a redevient le plus récent
    await service.getClient('tenant-c'); // évince b, le moins récent

    expect(service.disconnections).toEqual(['tenant-b']);
  });

  it('ferme tous les clients à l’arrêt du module', async () => {
    const service = buildService();
    await service.getClient('tenant-demo');
    await service.onModuleDestroy();
    expect(service.disconnections).toEqual(['tenant-demo']);
  });
});
