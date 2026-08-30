import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { CaseVerification } from '../../domain/case-verification/entity/case-verification';
import { VerificationStatusEnum } from '../../domain/case-verification/value-objects/verification-status.vo';
import { CaseVerificationRepository } from '../../domain/case-verification/repository/case-verification.repository';

export class InMemoryCaseVerificationRepository implements CaseVerificationRepository {
  readonly store = new Map<string, CaseVerification>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(verification: CaseVerification): void {
    this.store.set(verification.id, verification);
  }

  async save(
    verification: CaseVerification,
    ...acts: AuditEventDraft[]
  ): Promise<void> {
    this.store.set(verification.id, verification);
    for (const act of acts) {
      await this.auditTrail.append(act);
    }
  }

  hasPendingFor(caseId: string, verifierUserId: string): Promise<boolean> {
    for (const verification of this.store.values()) {
      if (
        verification.caseId === caseId &&
        verification.verifierUserId === verifierUserId &&
        verification.status === VerificationStatusEnum.PENDING
      ) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }
}
