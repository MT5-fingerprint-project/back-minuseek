import { SubjectCase } from '../entity/subject-case';

export interface SubjectCaseRepository {
  save(subjectCase: SubjectCase): Promise<void>;
  existsBySubjectAndCase(subjectId: string, caseId: string): Promise<boolean>;
}

export const SUBJECT_CASE_REPOSITORY = 'SubjectCaseRepository';
