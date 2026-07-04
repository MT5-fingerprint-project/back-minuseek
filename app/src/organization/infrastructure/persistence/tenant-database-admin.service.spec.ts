import type { Pool } from 'pg';
import { TenantDatabaseAdminService } from './tenant-database-admin.service';

class StubPool {
  query = jest
    .fn<Promise<{ rowCount: number }>, [string, unknown[]?]>()
    .mockResolvedValue({ rowCount: 0 });
  end = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
}

class TestableTenantDatabaseAdminService extends TenantDatabaseAdminService {
  readonly pool = new StubPool();
  poolOpenings = 0;
  migrateCalls: string[] = [];

  protected override openAdminPool(): Pool {
    this.poolOpenings += 1;
    return this.pool as unknown as Pool;
  }

  protected override runPrismaMigrateDeploy(
    databaseUrl: string,
  ): Promise<void> {
    this.migrateCalls.push(databaseUrl);
    return Promise.resolve();
  }
}

function buildService() {
  process.env.ADMIN_DATABASE_URL =
    'postgresql://minuseek:test@localhost:5432/minuseek_admin';
  process.env.TENANT_DATABASE_URL_TEMPLATE =
    'postgresql://minuseek:test@localhost:5432/{db}';
  return new TestableTenantDatabaseAdminService();
}

describe('TenantDatabaseAdminService', () => {
  it('rejette un nom de base hors convention AVANT toute connexion', async () => {
    const service = buildService();
    await expect(
      service.ensureDatabase('minuseek";DROP DATABASE x'),
    ).rejects.toThrow('Nom de base invalide');
    expect(service.poolOpenings).toBe(0);
  });

  it('crée la base quand elle est absente', async () => {
    const service = buildService();
    await service.ensureDatabase('minuseek_labo_lyon');

    expect(service.pool.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      ['minuseek_labo_lyon'],
    );
    expect(service.pool.query).toHaveBeenCalledWith(
      'CREATE DATABASE "minuseek_labo_lyon"',
    );
    expect(service.pool.end).toHaveBeenCalled();
  });

  it('ne recrée pas une base existante (rejeu de saga)', async () => {
    const service = buildService();
    service.pool.query.mockResolvedValueOnce({ rowCount: 1 });

    await service.ensureDatabase('minuseek_labo_lyon');

    expect(service.pool.query).toHaveBeenCalledTimes(1);
  });

  it('termine les connexions en vol avant de dropper la base', async () => {
    const service = buildService();
    await service.dropDatabase('minuseek_labo_lyon');

    const executedQueries = service.pool.query.mock.calls.map(([sql]) => sql);
    expect(executedQueries[0]).toContain('pg_terminate_backend');
    expect(executedQueries[1]).toBe(
      'DROP DATABASE IF EXISTS "minuseek_labo_lyon"',
    );
  });

  it('migre la base avec l’URL dérivée du template', async () => {
    const service = buildService();
    await service.migrate('minuseek_labo_lyon');

    expect(service.migrateCalls).toEqual([
      'postgresql://minuseek:test@localhost:5432/minuseek_labo_lyon',
    ]);
  });
});
