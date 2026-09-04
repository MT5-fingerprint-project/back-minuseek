import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import type { MinutiaPair } from '../entity/minutia-pair';

export const MINUTIA_PAIR_REPOSITORY = Symbol('MINUTIA_PAIR_REPOSITORY');

export interface MinutiaPairRepository {
  save(pair: MinutiaPair, act: AuditEventDraft): Promise<void>;
  findById(id: string): Promise<MinutiaPair | null>;
  delete(id: string, act: AuditEventDraft): Promise<void>;
  findByMinutiaLayerId(layerId: string): Promise<MinutiaPair[]>;
}
