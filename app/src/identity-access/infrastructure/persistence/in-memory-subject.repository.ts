import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { Subject } from '../../domain/subject/entity/subject';
import { SubjectRepository } from '../../domain/subject/repository/subject.repository';

export class InMemorySubjectRepository implements SubjectRepository {
  readonly store = new Map<string, Subject>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  async save(subject: Subject, ...acts: AuditEventDraft[]): Promise<void> {
    this.store.set(subject.id, subject);
    for (const act of acts) {
      await this.auditTrail.append(act);
    }
  }
}
