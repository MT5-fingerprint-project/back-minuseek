import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../../shared/shared.module';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { AuditTrailModule } from '../../audit-trail.module';
import { TenantChainVerificationRunner } from '../verification/tenant-chain-verification.runner';

/**
 * Vérification hors HTTP : c'est le seul outil qui dit qu'une chaîne est
 * correcte de bout en bout. Sort en code 1 dès qu'un tenant est rompu, pour
 * qu'un scheduler ou la CI puisse s'en servir tel quel.
 *
 * Usage :
 *   pnpm ts-node src/audit-trail/infrastructure/cli/verify-chain.cli.ts [slug]
 */
@Module({
  imports: [CqrsModule, SharedModule, TenancyModule, AuditTrailModule],
})
class ChainVerificationCliModule {}

async function main(): Promise<void> {
  const [tenantSlug] = process.argv.slice(2);
  const applicationContext = await NestFactory.createApplicationContext(
    ChainVerificationCliModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const runner = applicationContext.get(TenantChainVerificationRunner);
    const verifications = await runner.verify(tenantSlug);

    for (const verification of verifications) {
      const verdict = verification.ok ? 'intègre' : 'ROMPUE';
      const details = [
        `${verification.eventsChecked} maillon(s) vérifié(s)`,
        verification.firstBrokenSeq
          ? `première rupture au seq ${verification.firstBrokenSeq}`
          : null,
        verification.error,
      ]
        .filter(Boolean)
        .join(', ');
      console.log(`${verification.tenant} : ${verdict} — ${details}`);
    }

    if (verifications.some((verification) => !verification.ok)) {
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
