import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { Hit } from '../../domain/hit/entity/hit';
import type { HitRepository } from '../../domain/hit/repository/hit.repository';

export class InMemoryHitRepository implements HitRepository {
  readonly store = new Map<string, Hit>();
  readonly withdrawnAt = new Map<string, Date>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  private key(traceId: string, referencePrintId: string): string {
    return `${traceId}:${referencePrintId}`;
  }

  seed(hit: Hit): void {
    this.store.set(this.key(hit.traceId, hit.referencePrintId), hit);
  }

  async save(hit: Hit, act: AuditEventDraft): Promise<void> {
    const key = this.key(hit.traceId, hit.referencePrintId);
    this.store.set(key, hit);
    this.withdrawnAt.delete(key);
    await this.auditTrail.append(act);
  }

  async withdrawByPair(
    traceId: string,
    referencePrintId: string,
    withdrawnAt: Date,
    act: AuditEventDraft,
  ): Promise<void> {
    const key = this.key(traceId, referencePrintId);
    if (this.store.has(key) && !this.withdrawnAt.has(key)) {
      this.withdrawnAt.set(key, withdrawnAt);
    }
    await this.auditTrail.append(act);
  }

  findByTraceId(traceId: string): Promise<Hit[]> {
    return Promise.resolve(
      [...this.store.entries()]
        .filter(
          ([key, hit]) => hit.traceId === traceId && !this.withdrawnAt.has(key),
        )
        .map(([, hit]) => hit),
    );
  }
}
