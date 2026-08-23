import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import type { Layer } from '../entity/layer';

export const LAYER_REPOSITORY = Symbol('LAYER_REPOSITORY');

export interface LayerRepository {
  save(layer: Layer, act: AuditEventDraft): Promise<void>;
  findById(id: string): Promise<Layer | null>;
  delete(id: string, act: AuditEventDraft): Promise<void>;
  countMinutiae(fingerprintId: string): Promise<number>;
}
