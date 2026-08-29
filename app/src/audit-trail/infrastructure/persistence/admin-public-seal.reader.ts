import { Injectable } from '@nestjs/common';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import type {
  PublicSealReader,
  PublicSealRecord,
  ReportNeighbours,
} from '../../application/ports/public-seal.reader';
import { AdminSealRegistry } from './admin-seal-registry';

@Injectable()
export class AdminPublicSealReader implements PublicSealReader {
  constructor(
    private readonly registry: AdminSealRegistry,
    private readonly tenantRegistry: TenantRegistryService,
  ) {}

  async findLaboratoryName(tenantSlug: string): Promise<string | null> {
    const tenant = await this.tenantRegistry.findBySlug(tenantSlug);
    return tenant?.displayName ?? null;
  }

  findSeal(
    tenantSlug: string,
    sha256: string,
  ): Promise<PublicSealRecord | null> {
    return this.registry.findSeal(tenantSlug, sha256);
  }

  reportNeighbours(
    tenantSlug: string,
    caseId: string,
    reportType: string,
    sealedAt: Date,
  ): Promise<ReportNeighbours> {
    return this.registry.reportNeighbours(
      tenantSlug,
      caseId,
      reportType,
      sealedAt,
    );
  }
}
