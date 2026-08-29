import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CqrsModule } from '@nestjs/cqrs';
import { SharedModule } from '../../../shared/shared.module';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { AuditTrailModule } from '../../audit-trail.module';
import { TenantSealProjectionRunner } from '../verification/tenant-seal-projection.runner';

@Module({
  imports: [CqrsModule, SharedModule, TenancyModule, AuditTrailModule],
})
class SealProjectionCliModule {}

async function main(): Promise<void> {
  const [tenantSlug] = process.argv.slice(2);
  const applicationContext = await NestFactory.createApplicationContext(
    SealProjectionCliModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const runner = applicationContext.get(TenantSealProjectionRunner);
    const projections = await runner.sync(tenantSlug);

    for (const projection of projections) {
      const details =
        projection.status === 'synced'
          ? `${projection.projected} scellé(s) projeté(s)`
          : (projection.error ?? '');
      console.log(`${projection.tenant} : ${projection.status} — ${details}`);
    }

    if (projections.some((projection) => projection.status === 'failed')) {
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
