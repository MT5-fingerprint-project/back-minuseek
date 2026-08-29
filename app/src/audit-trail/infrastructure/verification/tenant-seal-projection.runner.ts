import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import { sealsFromEvents } from '../../application/seals/seal-projection';
import { AdminSealRegistry } from '../persistence/admin-seal-registry';
import { PrismaSealSourceReader } from '../persistence/prisma-seal-source.reader';

const BATCH_SIZE = 500;

export interface TenantSealProjection {
  tenant: string;
  status: 'synced' | 'failed';
  projected?: number;
  error?: string;
}

@Injectable()
export class TenantSealProjectionRunner {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    private readonly tenantContext: TenantContextService,
    private readonly source: PrismaSealSourceReader,
    private readonly registry: AdminSealRegistry,
  ) {}

  async sync(tenantSlug?: string): Promise<TenantSealProjection[]> {
    if (tenantSlug) {
      const tenant = await this.tenantRegistry.findBySlug(tenantSlug);
      if (!tenant) {
        return [
          {
            tenant: tenantSlug,
            status: 'failed',
            error: 'tenant inconnu du registre',
          },
        ];
      }
      return [await this.syncTenant(tenantSlug)];
    }

    const tenants = await this.tenantRegistry.list();
    const projections: TenantSealProjection[] = [];
    for (const tenant of tenants) {
      projections.push(await this.syncTenant(tenant.slug));
    }
    return projections;
  }

  private async syncTenant(slug: string): Promise<TenantSealProjection> {
    try {
      const projected = await this.tenantContext.run(
        { slug },
        async (): Promise<number> => {
          const anchors = await this.source.readAnchorPoints();
          let cursor = 0n;
          let projected = 0;

          for (;;) {
            const events = await this.source.readSealingEvents(
              cursor,
              BATCH_SIZE,
            );
            if (events.length === 0) {
              return projected;
            }
            const seals = sealsFromEvents(events, anchors);
            await this.registry.projectTenant(slug, seals);
            projected += seals.length;
            cursor = events[events.length - 1].seq;
          }
        },
      );
      return { tenant: slug, status: 'synced', projected };
    } catch (error) {
      return {
        tenant: slug,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
