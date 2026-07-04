import { TenantRecord } from '../../../../tenancy/application/tenant-registry.service';

export class CreateOrganizationCommand {
  constructor(
    public readonly slug: string,
    public readonly displayName: string,
  ) {}
}

export interface ProvisionedOrganization extends TenantRecord {
  realm: string;
}
