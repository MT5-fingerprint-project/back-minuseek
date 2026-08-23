import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { ReferencePrint } from '../../domain/reference-print/entity/reference-print';
import { ReferencePrintRepository } from '../../domain/reference-print/repository/reference-print.repository';

export class InMemoryReferencePrintRepository implements ReferencePrintRepository {
  readonly store = new Map<string, ReferencePrint>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(rp: ReferencePrint): void {
    this.store.set(rp.id, rp);
  }

  async save(rp: ReferencePrint, act: AuditEventDraft): Promise<void> {
    this.store.set(rp.id, rp);
    await this.auditTrail.append(act);
  }

  findById(id: string): Promise<ReferencePrint | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  async delete(id: string, act: AuditEventDraft): Promise<void> {
    this.store.delete(id);
    await this.auditTrail.append(act);
  }
}
