export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export interface CreatedUser {
  username: string;
  temporaryPassword: string | null;
}

export interface IdentityProviderPort {
  ensureRealm(realm: string, displayName: string): Promise<void>;
  deleteRealm(realm: string): Promise<void>;
  createUser(realm: string, email: string): Promise<CreatedUser>;
}
