import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { Trace } from '../../domain/trace/entity/trace';
import { TraceRepository } from '../../domain/trace/repository/trace.repository';

export class InMemoryTraceRepository implements TraceRepository {
  readonly store = new Map<string, Trace>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(trace: Trace): void {
    this.store.set(trace.id, trace);
  }

  async save(trace: Trace, act: AuditEventDraft): Promise<AuditLink> {
    this.store.set(trace.id, trace);
    return this.auditTrail.append(act);
  }

  findById(id: string): Promise<Trace | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }
}
