import { SubjectReadModel } from './subject-read-model';

export interface SubjectReader {
  findById(id: string): Promise<SubjectReadModel | null>;
}

export const SUBJECT_READER = 'SubjectReader';
