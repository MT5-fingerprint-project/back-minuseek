import { Subject } from '../entity/subject';

export interface SubjectRepository {
  save(subject: Subject): Promise<void>;
  findById(id: string): Promise<Subject | null>;
}

export const SUBJECT_REPOSITORY = 'SubjectRepository';
