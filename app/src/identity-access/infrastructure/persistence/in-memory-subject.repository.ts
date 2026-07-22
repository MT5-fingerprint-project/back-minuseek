import { Subject } from '../../domain/subject/entity/subject';
import { SubjectRepository } from '../../domain/subject/repository/subject.repository';

export class InMemorySubjectRepository implements SubjectRepository {
  readonly store = new Map<string, Subject>();

  save(subject: Subject): Promise<void> {
    this.store.set(subject.id, subject);
    return Promise.resolve();
  }

  findById(id: string): Promise<Subject | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }
}
