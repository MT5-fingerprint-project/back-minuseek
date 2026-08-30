import {
  AuditEventDraft,
  AuditLink,
} from '../../../../shared/domain/ports/audit-trail.port';
import { TraceLocationPhoto } from '../entity/trace-location-photo';

export interface TraceLocationPhotoRepository {
  save(photo: TraceLocationPhoto, act: AuditEventDraft): Promise<AuditLink>;
  findByTraceId(traceId: string): Promise<TraceLocationPhoto | null>;
  delete(id: string, act: AuditEventDraft): Promise<AuditLink>;
}

export const TRACE_LOCATION_PHOTO_REPOSITORY = 'TraceLocationPhotoRepository';
