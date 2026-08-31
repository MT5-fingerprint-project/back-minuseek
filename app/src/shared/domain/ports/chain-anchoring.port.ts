export interface ChainAnchoringPort {
  anchor(): Promise<void>;
}

export const CHAIN_ANCHORING = 'ChainAnchoring';
