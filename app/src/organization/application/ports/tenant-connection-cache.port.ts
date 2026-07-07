export const TENANT_CONNECTION_CACHE = Symbol('TENANT_CONNECTION_CACHE');

export interface TenantConnectionCachePort {
  evict(slug: string): Promise<void>;
}
