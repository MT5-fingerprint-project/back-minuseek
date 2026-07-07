import { Injectable } from '@nestjs/common';
import {
  TenantRecord,
  TenantRegistryService,
} from '../../../../tenancy/application/tenant-registry.service';

@Injectable()
export class ListOrganizationsHandler {
  constructor(private readonly tenantRegistry: TenantRegistryService) {}

  execute(): Promise<TenantRecord[]> {
    return this.tenantRegistry.list();
  }
}
