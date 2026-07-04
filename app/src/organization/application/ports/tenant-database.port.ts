import { EnsureResult } from './identity-provider.port';

export const TENANT_DATABASE_ADMIN = Symbol('TENANT_DATABASE_ADMIN');

export interface TenantDatabaseAdminPort {
  ensureDatabase(databaseName: string): Promise<EnsureResult>;
  dropDatabase(databaseName: string): Promise<void>;
  migrate(databaseName: string): Promise<void>;
}
