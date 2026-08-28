import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  CaseExpertise,
  CaseExpertisePrimitives,
} from '../../domain/case-expertise/entity/case-expertise';
import { CaseExpertiseRepository } from '../../domain/case-expertise/repository/case-expertise.repository';

export class InMemoryCaseExpertiseRepository implements CaseExpertiseRepository {
  readonly store = new Map<string, CaseExpertisePrimitives>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(expertise: CaseExpertise): void {
    const primitives = expertise.toPrimitives();
    this.store.set(primitives.caseId, primitives);
  }

  async save(
    expertise: CaseExpertise,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    this.seed(expertise);
    for (const act of acts) {
      await this.auditTrail.append(act);
    }
  }

  existsForCase(caseId: string): Promise<boolean> {
    return Promise.resolve(this.store.has(caseId));
  }
}
