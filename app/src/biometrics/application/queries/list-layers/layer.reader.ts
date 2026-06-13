import type { LayerReadModel } from './layer-read-model';

export const LAYER_READER = Symbol('LAYER_READER');

export interface LayerReader {
  findByFingerprintId(fingerprintId: string): Promise<LayerReadModel[]>;
}
