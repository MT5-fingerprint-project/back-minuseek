export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export interface CreatedUser {
  username: string;
  temporaryPassword: string | null;
}

export interface EnsureResult {
  created: boolean;
}

export interface IdentityProviderPort {
  ensureRealm(realm: string, displayName: string): Promise<EnsureResult>;
  deleteRealm(realm: string): Promise<void>;
  createUser(realm: string, email: string): Promise<CreatedUser>;
}
