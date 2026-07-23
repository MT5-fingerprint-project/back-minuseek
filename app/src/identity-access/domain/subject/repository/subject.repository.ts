import { Subject } from '../entity/subject';

export interface SubjectRepository {
  save(subject: Subject): Promise<void>;
}

export const SUBJECT_REPOSITORY = 'SubjectRepository';
