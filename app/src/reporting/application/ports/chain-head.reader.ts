export interface ChainHeadSummary {
  seq: number;
  hash: string;
}

export interface ChainHeadReader {
  read(): Promise<ChainHeadSummary | null>;
}

export const CHAIN_HEAD_READER = 'ChainHeadReader';
