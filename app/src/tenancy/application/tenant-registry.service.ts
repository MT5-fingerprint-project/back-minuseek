import { Injectable } from '@nestjs/common';
import { AdminPrismaService } from '../infrastructure/persistence/admin-prisma.service';

export interface TenantRecord {
  id: string;
  slug: string;
  displayName: string;
  databaseName: string;
  identityProviderRealm: string;
}

const REGISTRY_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 10_000;
const CACHE_MAX_ENTRIES = 1_000;

interface CacheEntry {
  value: TenantRecord | null;
  expiresAt: number;
}

@Injectable()
export class TenantRegistryService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly adminPrisma: AdminPrismaService) {}

  async findBySlug(slug: string): Promise<TenantRecord | null> {
    const now = Date.now();
    const cached = this.cache.get(slug);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const row = await this.adminPrisma.findTenantBySlug(slug);

    const ttl = row ? REGISTRY_TTL_MS : NEGATIVE_TTL_MS;
    this.evictIfFull(now);
    this.cache.set(slug, { value: row, expiresAt: now + ttl });

    return row;
  }

  private evictIfFull(now: number): void {
    if (this.cache.size < CACHE_MAX_ENTRIES) {
      return;
    }
    for (const [slug, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(slug);
      }
    }
    for (const oldestSlug of this.cache.keys()) {
      if (this.cache.size < CACHE_MAX_ENTRIES) {
        return;
      }
      this.cache.delete(oldestSlug);
    }
  }

  async register(record: Omit<TenantRecord, 'id'>): Promise<TenantRecord> {
    const created = await this.adminPrisma.createTenant(record);
    this.invalidate(created.slug);
    return created;
  }

  invalidate(slug: string): void {
    this.cache.delete(slug);
  }
}
