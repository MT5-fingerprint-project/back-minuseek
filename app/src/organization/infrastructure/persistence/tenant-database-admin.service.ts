import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { TenantDatabaseAdminPort } from '../../application/ports/tenant-database.port';

const execFileAsync = promisify(execFile);

const PROVISIONING_POOL_MAX = 2;

const DATABASE_NAME_PATTERN = /^[a-z0-9_]+$/;


@Injectable()
export class TenantDatabaseAdminService implements TenantDatabaseAdminPort {
  private readonly logger = new Logger(TenantDatabaseAdminService.name);

  async ensureDatabase(databaseName: string): Promise<void> {
    assertValidDatabaseName(databaseName);
    const pool = this.openAdminPool();
    try {
      const existing = await pool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [databaseName],
      );
      if ((existing.rowCount ?? 0) > 0) {
        this.logger.log(`Base ${databaseName} déjà présente, inchangée`);
        return;
      }
      await pool.query(`CREATE DATABASE "${databaseName}"`);
      this.logger.log(`Base ${databaseName} créée`);
    } finally {
      await pool.end();
    }
  }

  async dropDatabase(databaseName: string): Promise<void> {
    assertValidDatabaseName(databaseName);
    const pool = this.openAdminPool();
    try {
      await pool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await pool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      this.logger.log(`Base ${databaseName} supprimée`);
    } finally {
      await pool.end();
    }
  }

  async migrate(databaseName: string): Promise<void> {
    assertValidDatabaseName(databaseName);
    const databaseUrl = requireEnv('TENANT_DATABASE_URL_TEMPLATE').replace(
      '{db}',
      databaseName,
    );
    await this.runPrismaMigrateDeploy(databaseUrl);
    this.logger.log(`Migrations appliquées sur ${databaseName}`);
  }

  protected openAdminPool(): Pool {
    return new Pool({
      connectionString: requireEnv('ADMIN_DATABASE_URL'),
      max: PROVISIONING_POOL_MAX,
    });
  }

  protected async runPrismaMigrateDeploy(databaseUrl: string): Promise<void> {
    await execFileAsync('node_modules/.bin/prisma', ['migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });
  }
}

function assertValidDatabaseName(databaseName: string): void {
  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(`Nom de base invalide: ${databaseName}`);
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}
