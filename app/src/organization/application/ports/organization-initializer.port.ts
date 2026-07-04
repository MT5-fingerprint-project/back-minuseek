export const ORGANIZATION_INITIALIZER = Symbol('ORGANIZATION_INITIALIZER');

export interface OrganizationInitializerPort {
  initialize(
    databaseName: string,
    slug: string,
    displayName: string,
  ): Promise<void>;
}
