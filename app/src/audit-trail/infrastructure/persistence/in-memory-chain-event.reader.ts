import type {
  ChainEventReader,
  ChainEventRow,
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
}
