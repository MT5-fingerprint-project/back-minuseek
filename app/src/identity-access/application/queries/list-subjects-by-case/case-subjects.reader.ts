import { CaseSubjectReadModel } from './case-subject-read-model';

export interface CaseSubjectsReader {
  findByCaseId(caseId: string): Promise<CaseSubjectReadModel[]>;
}

export const CASE_SUBJECTS_READER = 'CaseSubjectsReader';
