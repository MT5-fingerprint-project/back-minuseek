export interface AuthenticatedUser {
  sub: string;
  iss?: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  tenantSlug?: string;
  isSystemRealm?: boolean;
  [claim: string]: unknown;
}

export const TENANT_SLUG_HEADER = 'x-tenant-slug';
