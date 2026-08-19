import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import { ChainVerificationReport } from '../../application/queries/verify-chain/chain-verification-report';
import { VerifyChainQuery } from '../../application/queries/verify-chain/verify-chain.query';

export interface TenantChainVerification extends ChainVerificationReport {
  tenant: string;
  error?: string;
}

@Injectable()
export class TenantChainVerificationRunner {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    private readonly tenantContext: TenantContextService,
    private readonly queryBus: QueryBus,
  ) {}

  async verify(tenantSlug?: string): Promise<TenantChainVerification[]> {
    if (tenantSlug) {
      const tenant = await this.tenantRegistry.findBySlug(tenantSlug);
      if (!tenant) {
        return [
          {
            tenant: tenantSlug,
            ok: false,
            eventsChecked: 0,
            error: 'tenant inconnu du registre',
          },
        ];
      }
      return [await this.verifyTenant(tenantSlug)];
    }

    const tenants = await this.tenantRegistry.list();
    const verifications: TenantChainVerification[] = [];
    // Fan-out séquentiel : un tenant en échec n'arrête pas la boucle, il finit
    // en `error` du récap.
    for (const tenant of tenants) {
      verifications.push(await this.verifyTenant(tenant.slug));
    }
    return verifications;
  }

  private async verifyTenant(slug: string): Promise<TenantChainVerification> {
    try {
      const report = await this.tenantContext.run({ slug }, () =>
        this.queryBus.execute<VerifyChainQuery, ChainVerificationReport>(
          new VerifyChainQuery(),
        ),
      );
      return { tenant: slug, ...report };
    } catch (error) {
      return {
        tenant: slug,
        ok: false,
        eventsChecked: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
