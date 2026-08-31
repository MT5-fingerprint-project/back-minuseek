import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { Subject } from '../entity/subject';

export interface SubjectRepository {
  save(subject: Subject, ...acts: AuditEventDraft[]): Promise<void>;
}

export const SUBJECT_REPOSITORY = 'SubjectRepository';
