import type {
  ChainAnchorRecord,
  ChainAnchorStore,
  ChainAnchorToSave,
} from '../../application/ports/chain-anchor.store';

export class InMemoryChainAnchorStore implements ChainAnchorStore {
  readonly store: ChainAnchorRecord[] = [];

  findLast(): Promise<ChainAnchorRecord | null> {
    const sorted = [...this.store].sort((left, right) =>
      Number(right.headSeq - left.headSeq),
    );
    return Promise.resolve(sorted[0] ?? null);
  }

  list(): Promise<ChainAnchorRecord[]> {
    return Promise.resolve(
      [...this.store].sort((left, right) =>
        Number(left.headSeq - right.headSeq),
      ),
    );
  }

  save(anchor: ChainAnchorToSave): Promise<void> {
    this.store.push({
      headSeq: anchor.headSeq,
      headHash: anchor.headHash,
      tsaUrl: anchor.tsaUrl,
      tsaResponse: anchor.tsaResponse,
      anchoredAt: anchor.anchoredAt,
    });
    return Promise.resolve();
  }
}
