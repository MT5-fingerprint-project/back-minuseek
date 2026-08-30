import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { VerificationDecision } from '../../domain/case-verification/entity/verification-decision';
import { VerificationDecisionRepository } from '../../domain/case-verification/repository/verification-decision.repository';

export class InMemoryVerificationDecisionRepository implements VerificationDecisionRepository {
  readonly store = new Map<string, VerificationDecision>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(decision: VerificationDecision): void {
    this.store.set(decision.id, decision);
  }

  findByVerificationId(
    verificationId: string,
  ): Promise<VerificationDecision[]> {
    return Promise.resolve(
      [...this.store.values()]
        .filter((decision) => decision.verificationId === verificationId)
        .sort((left, right) => left.traceId.localeCompare(right.traceId)),
    );
  }

  async save(
    decision: VerificationDecision,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    this.store.set(decision.id, decision);
    for (const act of acts) {
      await this.auditTrail.append(act);
    }
  }

  saveAll(decisions: VerificationDecision[]): Promise<void> {
    for (const decision of decisions) {
      this.store.set(decision.id, decision);
    }
    return Promise.resolve();
  }
}
