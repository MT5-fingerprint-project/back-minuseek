import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { Hit } from '../../domain/hit/entity/hit';
import type { HitRepository } from '../../domain/hit/repository/hit.repository';

export class InMemoryHitRepository implements HitRepository {
  readonly store = new Map<string, Hit>();

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
    this.store.set(this.key(hit.traceId, hit.referencePrintId), hit);
    await this.auditTrail.append(act);
  }

  async deleteByPair(
    traceId: string,
    referencePrintId: string,
    act: AuditEventDraft,
  ): Promise<void> {
    this.store.delete(this.key(traceId, referencePrintId));
    await this.auditTrail.append(act);
  }

  findByTraceId(traceId: string): Promise<Hit[]> {
    return Promise.resolve(
      [...this.store.values()].filter((hit) => hit.traceId === traceId),
    );
  }
}
