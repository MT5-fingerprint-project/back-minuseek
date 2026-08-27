import type {
  ServiceAccountIdentityPort,
  ServiceAccountProfile,
} from '../../application/ports/service-account-identity.port';

export interface RecordedEnabling {
  identityProviderId: string;
  enabled: boolean;
}

export interface RecordedRename extends ServiceAccountProfile {
  identityProviderId: string;
}

/** Imite le contrat de l'adapter Keycloak : il n'avale jamais un échec, et il
 * n'accepte aucun royaume — celui-ci vient du contexte tenant. */
export class InMemoryServiceAccountIdentity implements ServiceAccountIdentityPort {
  readonly calls: RecordedEnabling[] = [];
  readonly renames: RecordedRename[] = [];
  failure: Error | undefined;

  constructor(private readonly trace: string[] = []) {}

  setEnabled(identityProviderId: string, enabled: boolean): Promise<void> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.trace.push('idp');
    this.calls.push({ identityProviderId, enabled });
    return Promise.resolve();
  }

  updateProfile(
    identityProviderId: string,
    profile: ServiceAccountProfile,
  ): Promise<void> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.trace.push('idp');
    this.renames.push({ identityProviderId, ...profile });
    return Promise.resolve();
  }
}
