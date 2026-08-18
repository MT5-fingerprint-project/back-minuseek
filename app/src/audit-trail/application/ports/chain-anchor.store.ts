export interface ChainAnchorToSave {
  id: string;
  headSeq: bigint;
  headHash: string;
  tsaUrl: string;
  tsaResponse: Buffer;
  anchoredAt: Date;
}

export interface ChainAnchorRecord {
  headSeq: bigint;
  headHash: string;
  tsaUrl: string;
  tsaResponse: Buffer;
  anchoredAt: Date;
}

export interface ChainAnchorStore {
  findLast(): Promise<ChainAnchorRecord | null>;
  list(): Promise<ChainAnchorRecord[]>;
  save(anchor: ChainAnchorToSave): Promise<void>;
}

export const CHAIN_ANCHOR_STORE = 'ChainAnchorStore';
