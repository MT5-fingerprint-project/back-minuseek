import { Layer } from '../../domain/layer/entity/layer';
import { MINUTIA_SETTINGS_TYPES } from '../../domain/layer/minutia';
import type { LayerRepository } from '../../domain/layer/repository/layer.repository';
import type { LayerReader } from '../../application/queries/list-layers/layer.reader';
import type { LayerReadModel } from '../../application/queries/list-layers/layer-read-model';

export class InMemoryLayerRepository implements LayerRepository, LayerReader {
  readonly store = new Map<string, Layer>();

  save(layer: Layer): Promise<void> {
    this.store.set(layer.id, layer);
    return Promise.resolve();
  }

  findById(id: string): Promise<Layer | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  delete(id: string): Promise<void> {
    this.store.delete(id);
    return Promise.resolve();
  }

  countMinutiae(fingerprintId: string): Promise<number> {
    const minutiaTypes: readonly string[] = MINUTIA_SETTINGS_TYPES;
    const count = [...this.store.values()]
      .map((layer) => layer.toPrimitives())
      .filter(
        (p) =>
          p.fingerprintId === fingerprintId &&
          p.type === 'ANNOTATION' &&
          typeof p.settings.type === 'string' &&
          minutiaTypes.includes(p.settings.type),
      ).length;
    return Promise.resolve(count);
  }

  findByFingerprintId(fingerprintId: string): Promise<LayerReadModel[]> {
    const rows = [...this.store.values()]
      .map((layer) => layer.toPrimitives())
      .filter((p) => p.fingerprintId === fingerprintId)
      .sort((a, b) => a.zIndex - b.zIndex);
    return Promise.resolve(rows);
  }
}
