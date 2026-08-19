import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { CaseAuditEventReadModel } from '../../application/queries/list-case-audit-events/case-audit-event-read-model';
import { CaseAuditEventReader } from '../../application/queries/list-case-audit-events/case-audit-event.reader';

export type StoredCaseAuditEvent = CaseAuditEventReadModel & {
  caseId: string;
};

function toReadModel(stored: StoredCaseAuditEvent): CaseAuditEventReadModel {
  return {
    seq: stored.seq,
    eventType: stored.eventType,
    evidenceClass: stored.evidenceClass,
    actor: stored.actor,
    occurredAt: stored.occurredAt,
    payload: stored.payload,
  };
}

export class InMemoryCaseAuditEventReader implements CaseAuditEventReader {
  readonly store: StoredCaseAuditEvent[] = [];

  findByCase(
    caseId: string,
    filters: { eventType?: AuditEventTypeEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ items: CaseAuditEventReadModel[]; total: number }> {
    let events = this.store.filter((event) => event.caseId === caseId);

    if (filters.eventType) {
      events = events.filter((event) => event.eventType === filters.eventType);
    }

    events.sort((left, right) => right.seq - left.seq);

    return Promise.resolve({
      items: events
        .slice(pagination.skip, pagination.skip + pagination.take)
        .map(toReadModel),
      total: events.length,
    });
  }
}
