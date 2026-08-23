import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { Trace } from '../entity/trace';

export interface TraceRepository {
  save(trace: Trace, act: AuditEventDraft): Promise<void>;
  findById(id: string): Promise<Trace | null>;
  delete(id: string, act: AuditEventDraft): Promise<void>;
}

export const TRACE_REPOSITORY = 'TraceRepository';
