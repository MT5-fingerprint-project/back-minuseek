import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import { AnchorChainCommand } from '../../application/commands/anchor-chain/anchor-chain.command';
import type { AnchoringOutcome } from '../../application/commands/anchor-chain/anchor-chain.handler';

export interface TenantAnchoring {
  tenant: string;
  status: 'anchored' | 'skipped' | 'failed';
  headSeq?: number;
  genTime?: Date;
  reason?: string;
  error?: string;
}

@Injectable()
export class TenantChainAnchoringRunner {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    private readonly tenantContext: TenantContextService,
    private readonly commandBus: CommandBus,
  ) {}

  async anchor(tenantSlug?: string): Promise<TenantAnchoring[]> {
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
      return [await this.anchorTenant(tenantSlug)];
    }

    const tenants = await this.tenantRegistry.list();
    const anchorings: TenantAnchoring[] = [];
    // Fan-out séquentiel borné : la durée totale croît en O(tenants) × latence
    // TSA, et un tenant en échec ne doit pas priver les suivants de leur ancre.
    for (const tenant of tenants) {
      anchorings.push(await this.anchorTenant(tenant.slug));
    }
    return anchorings;
  }

  private async anchorTenant(slug: string): Promise<TenantAnchoring> {
    try {
      const outcome = await this.tenantContext.run({ slug }, () =>
        this.commandBus.execute<AnchorChainCommand, AnchoringOutcome>(
          new AnchorChainCommand(),
        ),
      );
      return outcome.status === 'anchored'
        ? {
            tenant: slug,
            status: 'anchored',
            headSeq: outcome.headSeq,
            genTime: outcome.genTime,
          }
        : { tenant: slug, status: 'skipped', reason: outcome.reason };
    } catch (error) {
      return {
        tenant: slug,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
