import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { TenancyModule } from '../../../tenancy/tenancy.module';
import { OrganizationModule } from '../../organization.module';
import { CreateOrganizationCommand } from '../../application/commands/create-organization/create-organization.command';
import { CreateOrganizationHandler } from '../../application/commands/create-organization/create-organization.handler';
import { OrganizationAlreadyExistsError } from '../../application/organization.errors';

/**
 * Porte d'entrée d'amorçage du provisioning (SUP-03), sans HTTP : tant que le
 * realm système n'existe pas, POST /organizations est inatteignable — ce CLI
 * exécute le même handler depuis un contexte Nest minimal (PAS AppModule :
 * le module biometrics exige GCS_BUCKET au boot, inutile ici).
 *
 * Usage :
 *   pnpm ts-node src/organization/infrastructure/cli/create-organization.cli.ts <slug> "<displayName>"
 *   node dist/src/organization/infrastructure/cli/create-organization.cli.js <slug> "<displayName>"
 */
@Module({
  imports: [TenancyModule, OrganizationModule],
})
class ProvisioningCliModule {}

async function main(): Promise<void> {
  const [slug, displayName] = process.argv.slice(2);
  if (!slug || !displayName) {
    console.error('Usage: create-organization.cli <slug> "<displayName>"');
    process.exit(1);
  }

  const applicationContext = await NestFactory.createApplicationContext(
    ProvisioningCliModule,
    { logger: ['error', 'warn', 'log'] },
  );
  try {
    const handler = applicationContext.get(CreateOrganizationHandler);
    const provisioned = await handler.execute(
      new CreateOrganizationCommand(slug, displayName),
    );
    console.log(
      `Organisation provisionnée : ${provisioned.slug} → realm=${provisioned.realm}, base=${provisioned.databaseName}`,
    );
  } catch (error) {
    if (error instanceof OrganizationAlreadyExistsError) {
      console.log(`Organisation ${slug} déjà provisionnée — rien à faire.`);
      return;
    }
    throw error;
  } finally {
    await applicationContext.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
