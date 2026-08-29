import {
  AuditEventDraft,
  AuditLink,
} from '../../../../shared/domain/ports/audit-trail.port';
import { Trace } from '../entity/trace';

export interface TraceRepository {
  save(trace: Trace, act: AuditEventDraft): Promise<AuditLink>;
  findById(id: string): Promise<Trace | null>;
}

export const TRACE_REPOSITORY = 'TraceRepository';
