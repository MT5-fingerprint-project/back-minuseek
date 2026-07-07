import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  TenantRecord,
  TenantRegistryService,
} from '../../application/tenant-registry.service';
import { TenantContextService } from '../../application/tenant-context.service';
import {
  NoTenantInContextError,
  TenantUnavailableError,
} from '../../application/tenancy.errors';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}

// Budget connexions (Cloud SQL db-f1-micro ≈ 25) : 3 par tenant actif
// + 4 admin ; les connexions inactives sont rendues au bout de 10 min.
const TENANT_POOL_MAX = 3;
const POOL_IDLE_TIMEOUT_MS = 10 * 60_000;
const CLIENT_CACHE_MAX = 16;

interface TenantClientEntry {
  client: PrismaClient;
  pool: Pool;
  /** Rang d'accès monotone (pas un timestamp : deux accès dans la même ms
   * rendraient l'éviction LRU ambiguë). */
  lastUsedRank: number;
}

/**
 * Cœur du data-plane (docs/multitenancy.md §4) : un PrismaClient par tenant,
 * créé à la demande depuis le registre (`databaseName` — jamais dérivé du
 * slug : la base du tenant-demo s'appelle `minuseek`) et gardé en cache.
 *
 * Deux accès :
 * - getClient(slug)   — EXPLICITE : jobs, provisioning, event handlers ;
 * - getCurrentClient() — IMPLICITE : repositories sur la chaîne HTTP, lit le
 *   tenant de l'AsyncLocalStorage et échoue fail-closed sans contexte.
 */
@Injectable()
export class TenantConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly entries = new Map<string, TenantClientEntry>();
  private readonly pendingCreations = new Map<string, Promise<PrismaClient>>();
  private accessCounter = 0;
  private readonly urlTemplate = requireEnv('TENANT_DATABASE_URL_TEMPLATE');
  protected readonly maxCachedClients: number = CLIENT_CACHE_MAX;

  constructor(
    private readonly tenantRegistry: TenantRegistryService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getClient(slug: string): Promise<PrismaClient> {
    const cached = this.entries.get(slug);
    if (cached) {
      cached.lastUsedRank = ++this.accessCounter;
      return cached.client;
    }

    // Single-flight : deux miss concurrents sur le même slug ne doivent pas
    // créer deux pools (l'un des deux resterait orphelin).
    const pending = this.pendingCreations.get(slug);
    if (pending) {
      return pending;
    }
    const creation = this.createClient(slug);
    this.pendingCreations.set(slug, creation);
    try {
      return await creation;
    } finally {
      this.pendingCreations.delete(slug);
    }
  }

  async getCurrentClient(): Promise<PrismaClient> {
    const slug = this.tenantContext.getCurrentTenant();
    if (!slug) {
      throw new NoTenantInContextError();
    }
    return this.getClient(slug);
  }

  /** À appeler AVANT un DROP DATABASE (SUP-05) ou à la bascule d'un restore
   * (SUP-10) : ferme le client et le pool, retire l'entrée du cache. */
  async evict(slug: string): Promise<void> {
    const entry = this.entries.get(slug);
    if (!entry) {
      return;
    }
    this.entries.delete(slug);
    await this.closeEntry(slug, entry);
  }

  async onModuleDestroy(): Promise<void> {
    const open = [...this.entries.entries()];
    this.entries.clear();
    await Promise.all(
      open.map(([slug, entry]) => this.closeEntry(slug, entry)),
    );
  }

  private async createClient(slug: string): Promise<PrismaClient> {
    const record = await this.tenantRegistry.findBySlug(slug);
    if (!record) {
      throw new TenantUnavailableError(slug);
    }
    // Le registre est de confiance, mais le nom finit dans une URL de
    // connexion : défense en profondeur.
    if (!/^[a-z0-9_]+$/.test(record.databaseName)) {
      throw new TenantUnavailableError(slug);
    }

    const entry = await this.instantiateClient(record);
    this.evictLeastRecentlyUsedIfFull();
    this.entries.set(slug, { ...entry, lastUsedRank: ++this.accessCounter });
    return entry.client;
  }

  /** Isolé pour être substituable en test (aucune vraie connexion). */
  protected async instantiateClient(
    record: TenantRecord,
  ): Promise<{ client: PrismaClient; pool: Pool }> {
    const pool = new Pool({
      connectionString: this.urlTemplate.replace('{db}', record.databaseName),
      max: TENANT_POOL_MAX,
      idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
      application_name: `minuseek-${record.slug}`,
    });
    const client = new PrismaClient({ adapter: new PrismaPg(pool) });
    await client.$connect();
    return { client, pool };
  }

  private evictLeastRecentlyUsedIfFull(): void {
    if (this.entries.size < this.maxCachedClients) {
      return;
    }
    let leastRecentSlug: string | undefined;
    let leastRecentRank = Number.POSITIVE_INFINITY;
    for (const [slug, entry] of this.entries) {
      if (entry.lastUsedRank < leastRecentRank) {
        leastRecentRank = entry.lastUsedRank;
        leastRecentSlug = slug;
      }
    }
    if (leastRecentSlug === undefined) {
      return;
    }
    const evicted = this.entries.get(leastRecentSlug);
    this.entries.delete(leastRecentSlug);
    if (evicted) {
      this.logger.warn(
        `Cache de clients plein : éviction du tenant ${leastRecentSlug}`,
      );
      void this.closeEntry(leastRecentSlug, evicted);
    }
  }

  private async closeEntry(
    slug: string,
    entry: TenantClientEntry,
  ): Promise<void> {
    try {
      await entry.client.$disconnect();
      await entry.pool.end();
    } catch (error) {
      this.logger.warn(
        `Fermeture du client du tenant ${slug} en échec: ${String(error)}`,
      );
    }
  }
}
