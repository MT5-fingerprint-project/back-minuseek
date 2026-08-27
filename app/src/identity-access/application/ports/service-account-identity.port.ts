export const SERVICE_ACCOUNT_IDENTITY = 'ServiceAccountIdentity';

export interface ServiceAccountProfile {
  firstName: string;
  lastName: string;
}

export interface ServiceAccountIdentityPort {
  setEnabled(identityProviderId: string, enabled: boolean): Promise<void>;
  updateProfile(
    identityProviderId: string,
    profile: ServiceAccountProfile,
  ): Promise<void>;
}
