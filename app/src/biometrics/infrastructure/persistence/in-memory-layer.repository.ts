import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { Layer } from '../../domain/layer/entity/layer';
import { MINUTIA_SETTINGS_TYPES } from '../../domain/layer/minutia';
import type { LayerRepository } from '../../domain/layer/repository/layer.repository';
import type { LayerReader } from '../../application/queries/list-layers/layer.reader';
import type { LayerReadModel } from '../../application/queries/list-layers/layer-read-model';

export class InMemoryLayerRepository implements LayerRepository, LayerReader {
  readonly store = new Map<string, Layer>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(layer: Layer): void {
    this.store.set(layer.id, layer);
  }

  async save(layer: Layer, act: AuditEventDraft): Promise<void> {
    this.store.set(layer.id, layer);
    await this.auditTrail.append(act);
  }

  findById(id: string): Promise<Layer | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  async delete(id: string, act: AuditEventDraft): Promise<void> {
    this.store.delete(id);
    await this.auditTrail.append(act);
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

  findByFingerprintId(
    fingerprintId: string,
    authoredBy?: string | null,
  ): Promise<LayerReadModel[]> {
    const rows = [...this.store.values()]
      .map((layer) => layer.toPrimitives())
      .filter(
        (p) =>
          p.fingerprintId === fingerprintId &&
          (authoredBy == null || p.createdByUserId === authoredBy),
      )
      .sort((a, b) => a.zIndex - b.zIndex);
    return Promise.resolve(rows);
  }
}
