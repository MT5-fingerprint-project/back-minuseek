export class CreateOrganizationCommand {
  constructor(
    public readonly slug: string,
    public readonly displayName: string,
  ) {}
}

export interface ProvisionedOrganization {
  slug: string;
  realm: string;
  databaseName: string;
}
