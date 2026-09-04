import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import type { Layer } from '../entity/layer';

export const LAYER_REPOSITORY = Symbol('LAYER_REPOSITORY');

export interface LayerRepository {
  save(layer: Layer, act: AuditEventDraft): Promise<void>;
  findById(id: string): Promise<Layer | null>;
  /** La base emporte les paires du calque : les actes du dépariement se
   * chaînent dans la même transaction que le retrait. */
  delete(id: string, acts: readonly AuditEventDraft[]): Promise<void>;
  countMinutiae(fingerprintId: string): Promise<number>;
}
