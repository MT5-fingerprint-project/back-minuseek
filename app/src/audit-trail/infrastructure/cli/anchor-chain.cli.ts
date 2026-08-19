import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../../shared/shared.module';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { AuditTrailModule } from '../../audit-trail.module';
import { TenantChainAnchoringRunner } from '../verification/tenant-chain-anchoring.runner';

/**
 * Ancrage manuel de la tête de chaîne. En dev il remplace le Cloud Scheduler
 * (3.3) : même use case, sans module Terraform à maintenir.
 *
 * Usage :
 *   pnpm ts-node src/audit-trail/infrastructure/cli/anchor-chain.cli.ts [slug]
 */
@Module({
  imports: [CqrsModule, SharedModule, TenancyModule, AuditTrailModule],
})
class ChainAnchoringCliModule {}

async function main(): Promise<void> {
  const [tenantSlug] = process.argv.slice(2);
  const applicationContext = await NestFactory.createApplicationContext(
    ChainAnchoringCliModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const runner = applicationContext.get(TenantChainAnchoringRunner);
    const anchorings = await runner.anchor(tenantSlug);

    for (const anchoring of anchorings) {
      const details =
        anchoring.status === 'anchored'
          ? `seq ${anchoring.headSeq} horodaté le ${anchoring.genTime?.toISOString()}`
          : (anchoring.reason ?? anchoring.error ?? '');
      console.log(`${anchoring.tenant} : ${anchoring.status} — ${details}`);
    }

    if (anchorings.some((anchoring) => anchoring.status === 'failed')) {
      process.exitCode = 1;
    }
  } finally {
    await applicationContext.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
