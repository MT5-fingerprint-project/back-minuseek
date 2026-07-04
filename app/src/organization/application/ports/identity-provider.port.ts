export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export interface TenantUser {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
}

export interface CreatedUser extends TenantUser {
  temporaryPassword: string | null;
}

export interface EnsureResult {
  created: boolean;
}

export interface CreateUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface IdentityProviderPort {
  ensureRealm(realm: string, displayName: string): Promise<EnsureResult>;
  deleteRealm(realm: string): Promise<void>;
  listUsers(realm: string): Promise<TenantUser[]>;
  createUser(realm: string, input: CreateUserInput): Promise<CreatedUser>;
  deleteUser(realm: string, userId: string): Promise<void>;
}
