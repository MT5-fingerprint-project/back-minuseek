import { PrismaAuditTrailAppender } from '../../../src/audit-trail/infrastructure/persistence/prisma-audit-trail.appender';
import { AuditTrailPort } from '../../../src/shared/domain/ports/audit-trail.port';
import { UuidGenerator } from '../../../src/shared/infrastructure/uuid-generator';
import { TenantContextService } from '../../../src/tenancy/application/tenant-context.service';
import {
  TenantRecord,
  TenantRegistryService,
} from '../../../src/tenancy/application/tenant-registry.service';
import { PrismaTransactionRunner } from '../../../src/tenancy/infrastructure/persistence/prisma-transaction-runner';
import { TenantConnectionService } from '../../../src/tenancy/infrastructure/persistence/tenant-connection.service';
import { TransactionContextService } from '../../../src/tenancy/infrastructure/persistence/transaction-context.service';
import { PrismaClient } from '../../../generated/prisma/client';
import { Pool } from 'pg';
import {
  INTEGRATION_DATABASE_URL_ENV,
  IntegrationDatabase,
  openIntegrationDatabase,
} from './integration-database';

export const INTEGRATION_TENANT_SLUG = 'tenant-integration';
const INTEGRATION_TENANT_DATABASE = 'minuseek_integration';

/**
 * Le client est déjà ouvert par la suite : on ne substitue QUE l'instanciation,
 * pour que le reste du service — cache, contexte tenant, restitution du client
 * transactionnel depuis l'ALS — soit celui de la production.
 */
class IntegrationTenantConnection extends TenantConnectionService {
  constructor(
    registry: TenantRegistryService,
    tenantContext: TenantContextService,
    transactionContext: TransactionContextService,
    private readonly database: IntegrationDatabase,
  ) {
    super(registry, tenantContext, transactionContext);
  }

  protected instantiateClient(): Promise<{ client: PrismaClient; pool: Pool }> {
    return Promise.resolve({
      client: this.database.client,
      pool: this.database.pool,
    });
  }
}

export interface AuditChainHarness {
  database: IntegrationDatabase;
  runner: PrismaTransactionRunner;
  appender: AuditTrailPort;
  connection: TenantConnectionService;
  /** Rejoue le contexte que le TenantGuard pose sur la chaîne HTTP. */
  asTenant<T>(work: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export async function openAuditChainHarness(): Promise<AuditChainHarness> {
  process.env['TENANT_DATABASE_URL_TEMPLATE'] ??= tenantUrlTemplate();

  const database = await openIntegrationDatabase();
  const tenantContext = new TenantContextService();
  const transactionContext = new TransactionContextService();
  const connection = new IntegrationTenantConnection(
    stubRegistry(),
    tenantContext,
    transactionContext,
    database,
  );
  const runner = new PrismaTransactionRunner(connection, transactionContext);
  const appender = new PrismaAuditTrailAppender(
    transactionContext,
    new UuidGenerator(),
  );

  return {
    database,
    runner,
    appender,
    connection,
    asTenant: (work) =>
      tenantContext.run({ slug: INTEGRATION_TENANT_SLUG }, work),
    close: () => database.close(),
  };
}

/** Le registre admin n'est pas le sujet : une seule ligne, en dur. */
function stubRegistry(): TenantRegistryService {
  const record: TenantRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    slug: INTEGRATION_TENANT_SLUG,
    displayName: 'Tenant intégration',
    databaseName: INTEGRATION_TENANT_DATABASE,
    identityProviderRealm: INTEGRATION_TENANT_SLUG,
  };
  return {
    findBySlug: () => Promise.resolve(record),
  } as unknown as TenantRegistryService;
}

/**
 * Jamais utilisée — `instantiateClient` est substituée — mais le constructeur
 * du service la réclame fail-closed. On la dérive de l'URL d'intégration plutôt
 * que d'inventer une valeur qui mentirait sur la base réellement ouverte.
 */
function tenantUrlTemplate(): string {
  const connectionString = process.env[INTEGRATION_DATABASE_URL_ENV] ?? '';
  const lastSlash = connectionString.lastIndexOf('/');
  return lastSlash === -1
    ? connectionString
    : `${connectionString.slice(0, lastSlash)}/{db}`;
}
