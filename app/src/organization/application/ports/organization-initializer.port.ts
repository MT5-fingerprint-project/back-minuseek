export const ORGANIZATION_INITIALIZER = Symbol('ORGANIZATION_INITIALIZER');

export interface OrganizationToInitialize {
  databaseName: string;
  slug: string;
  displayName: string;
  realm: string;
}

export interface OrganizationInitializerPort {
  initialize(organization: OrganizationToInitialize): Promise<void>;
}
