import { SubjectReadModel } from '../../application/queries/get-subject-by-id/subject-read-model';
import { SubjectReader } from '../../application/queries/get-subject-by-id/subject.reader';

export class InMemorySubjectReader implements SubjectReader {
  readonly store: SubjectReadModel[] = [];

  findById(id: string): Promise<SubjectReadModel | null> {
    return Promise.resolve(this.store.find((s) => s.id === id) ?? null);
  }
}
