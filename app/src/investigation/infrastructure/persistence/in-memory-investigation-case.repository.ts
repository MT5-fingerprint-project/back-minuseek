import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import { InvestigationCaseRepository } from '../../domain/investigation-case/repository/investigation-case.repository';

export class InMemoryInvestigationCaseRepository implements InvestigationCaseRepository {
  readonly store = new Map<string, InvestigationCase>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(c: InvestigationCase): void {
    this.store.set(c.id, c);
  }

  async save(c: InvestigationCase, act: AuditEventDraft): Promise<void> {
    this.store.set(c.id, c);
    await this.auditTrail.append(act);
  }

  findById(id: string): Promise<InvestigationCase | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  existsByCaseNumber(caseNumber: string): Promise<boolean> {
    for (const c of this.store.values()) {
      if (c.caseNumber === caseNumber) return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}
