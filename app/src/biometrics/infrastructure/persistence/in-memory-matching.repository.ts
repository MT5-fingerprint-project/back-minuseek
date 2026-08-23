import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { AuditTrailPort } from '../../../shared/domain/ports/audit-trail.port';
import { Matching } from '../../domain/matching/entity/matching';
import {
  MatchingRepository,
  MatchingWrite,
} from '../../domain/matching/repository/matching.repository';

export class InMemoryMatchingRepository implements MatchingRepository {
  readonly store = new Map<string, Matching>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  private key(traceId: string, referencePrintId: string): string {
    return `${traceId}:${referencePrintId}`;
  }

  seed(matching: Matching): void {
    this.store.set(
      this.key(matching.traceId, matching.referencePrintId),
      matching,
    );
  }

  async upsertMany(writes: MatchingWrite[]): Promise<void> {
    for (const { matching, act } of writes) {
      this.store.set(
        this.key(matching.traceId, matching.referencePrintId),
        matching,
      );
      await this.auditTrail.append(act);
    }
  }

  findByTraceId(traceId: string): Promise<Matching[]> {
    return Promise.resolve(
      [...this.store.values()].filter((m) => m.traceId === traceId),
    );
  }
}
