import { Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import { StructuredLogger } from '../../../shared/infrastructure/logging/structured-logger';
import { ChainVerificationReport } from '../../application/queries/verify-chain/chain-verification-report';
import { VerifyChainQuery } from '../../application/queries/verify-chain/verify-chain.query';

export interface TenantChainVerification extends ChainVerificationReport {
  tenant: string;
  error?: string;
}

export interface ChainVerificationSummary {
  ok: boolean;
  tenantsChecked: number;
  brokenTenants: string[];
  verifications: TenantChainVerification[];
}

@Injectable()
export class TenantChainVerificationRunner {
  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    private readonly tenantContext: TenantContextService,
    private readonly queryBus: QueryBus,
    private readonly logger: StructuredLogger,
  ) {}

  async verify(tenantSlug?: string): Promise<ChainVerificationSummary> {
    const verifications = await this.verifyEach(tenantSlug);
    const brokenTenants = verifications
      .filter((verification) => !verification.ok)
      .map((verification) => verification.tenant);

    return {
      ok: brokenTenants.length === 0,
      tenantsChecked: verifications.length,
      brokenTenants,
      verifications,
    };
  }

  private async verifyEach(
    tenantSlug?: string,
  ): Promise<TenantChainVerification[]> {
    if (tenantSlug) {
      const tenant = await this.tenantRegistry.findBySlug(tenantSlug);
      if (!tenant) {
        return [
          {
            tenant: tenantSlug,
            ok: false,
            eventsChecked: 0,
            anchors: { verified: 0, failed: 0 },
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
    const verification = await this.runVerification(slug);
    // Une rupture doit se voir en heures, pas au premier rapport : c'est cette
    // ligne que l'alerting de 14.2 observera.
    this.logger.log(
      verification.ok ? 'INFO' : 'ERROR',
      verification.ok
        ? "chaîne d'audit intègre"
        : "rupture de la chaîne d'audit",
      {
        tenant: verification.tenant,
        ok: verification.ok,
        eventsChecked: verification.eventsChecked,
        firstBrokenSeq: verification.firstBrokenSeq,
        anchorsVerified: verification.anchors.verified,
        anchorsFailed: verification.anchors.failed,
        truncatedBelowSeq: verification.truncatedBelowSeq,
        error: verification.error,
      },
    );
    return verification;
  }

  private async runVerification(
    slug: string,
  ): Promise<TenantChainVerification> {
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
        anchors: { verified: 0, failed: 0 },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
