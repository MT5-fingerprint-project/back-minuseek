import type { Layer } from '../entity/layer';

export const LAYER_REPOSITORY = Symbol('LAYER_REPOSITORY');

export interface LayerRepository {
  save(layer: Layer): Promise<void>;
  findById(id: string): Promise<Layer | null>;
  delete(id: string): Promise<void>;
}
