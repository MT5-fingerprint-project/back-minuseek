import { Hit } from '../../domain/hit/entity/hit';
import type { HitRepository } from '../../domain/hit/repository/hit.repository';

export class InMemoryHitRepository implements HitRepository {
  readonly store = new Map<string, Hit>();

  private key(traceId: string, referencePrintId: string): string {
    return `${traceId}:${referencePrintId}`;
  }

  save(hit: Hit): Promise<void> {
    this.store.set(this.key(hit.traceId, hit.referencePrintId), hit);
    return Promise.resolve();
  }

  deleteByPair(traceId: string, referencePrintId: string): Promise<void> {
    this.store.delete(this.key(traceId, referencePrintId));
    return Promise.resolve();
  }

  findByTraceId(traceId: string): Promise<Hit[]> {
    return Promise.resolve(
      [...this.store.values()].filter((hit) => hit.traceId === traceId),
    );
  }
}
