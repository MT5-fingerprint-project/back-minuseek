import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { TraceLocationPhoto } from '../../domain/trace-location-photo/entity/trace-location-photo';
import { TraceLocationPhotoRepository } from '../../domain/trace-location-photo/repository/trace-location-photo.repository';

export class InMemoryTraceLocationPhotoRepository implements TraceLocationPhotoRepository {
  readonly store = new Map<string, TraceLocationPhoto>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(photo: TraceLocationPhoto): void {
    this.store.set(photo.id, photo);
  }

  async save(
    photo: TraceLocationPhoto,
    act: AuditEventDraft,
  ): Promise<AuditLink> {
    this.store.set(photo.id, photo);
    return this.auditTrail.append(act);
  }

  findByTraceId(traceId: string): Promise<TraceLocationPhoto | null> {
    const found = [...this.store.values()].find(
      (photo) => photo.traceId === traceId,
    );
    return Promise.resolve(found ?? null);
  }

  async delete(id: string, act: AuditEventDraft): Promise<AuditLink> {
    this.store.delete(id);
    return this.auditTrail.append(act);
  }
}
