import type {
  SealRegistryPort,
  SealToRecord,
} from '../../../shared/domain/ports/seal-registry.port';

export type StoredSeal = SealToRecord & {
  tenantSlug: string;
  anchoredAt: Date | null;
};

export class InMemorySealRegistry implements SealRegistryPort {
  readonly seals: StoredSeal[] = [];
  failWith: Error | null = null;

  constructor(private readonly tenantSlug = 'demo') {}

  record(seal: SealToRecord): Promise<void> {
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    const known = this.seals.some(
      (stored) =>
        stored.tenantSlug === this.tenantSlug && stored.sha256 === seal.sha256,
    );
    if (!known) {
      this.seals.push({
        ...seal,
        reportType: seal.reportType ?? null,
        tenantSlug: this.tenantSlug,
        anchoredAt: null,
      });
    }
    return Promise.resolve();
  }
}
