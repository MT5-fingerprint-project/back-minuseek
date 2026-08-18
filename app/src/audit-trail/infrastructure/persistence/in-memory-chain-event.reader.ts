import type {
  ChainEventReader,
  ChainEventRow,
  ChainHead,
} from '../../application/queries/verify-chain/chain-event.reader';

export class InMemoryChainEventReader implements ChainEventReader {
  readonly store: ChainEventRow[] = [];

  findBatchAfter(seq: bigint, take: number): Promise<ChainEventRow[]> {
    const rows = [...this.store]
      .sort((left, right) => Number(left.seq - right.seq))
      .filter((row) => row.seq > seq)
      .slice(0, take);
    return Promise.resolve(rows);
  }

  findHead(): Promise<ChainHead | null> {
    const sorted = [...this.store].sort((left, right) =>
      Number(right.seq - left.seq),
    );
    const head = sorted[0];
    return Promise.resolve(
      head
        ? { seq: head.seq, hash: head.hash, eventType: head.eventType }
        : null,
    );
  }

  findBySeq(seq: bigint): Promise<ChainEventRow | null> {
    return Promise.resolve(this.store.find((row) => row.seq === seq) ?? null);
  }
}
