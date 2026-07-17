import { Matching } from '../../domain/matching/entity/matching';
import { MatchingRepository } from '../../domain/matching/repository/matching.repository';

export class InMemoryMatchingRepository implements MatchingRepository {
  readonly store = new Map<string, Matching>();

  private key(traceId: string, referencePrintId: string): string {
    return `${traceId}:${referencePrintId}`;
  }

  upsertMany(matchings: Matching[]): Promise<void> {
    for (const matching of matchings) {
      this.store.set(
        this.key(matching.traceId, matching.referencePrintId),
        matching,
      );
    }
    return Promise.resolve();
  }

  findByTraceId(traceId: string): Promise<Matching[]> {
    return Promise.resolve(
      [...this.store.values()].filter((m) => m.traceId === traceId),
    );
  }
}
