import type { Layer } from './entity/layer';

export function layerAuditPayload(layer: Layer): Record<string, unknown> {
  const { id, ...state } = layer.toPrimitives();
  return { layerId: id, ...state };
}
