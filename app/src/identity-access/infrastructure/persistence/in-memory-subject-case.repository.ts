import { SubjectCase } from '../../domain/subject-case/entity/subject-case';
import { SubjectCaseRepository } from '../../domain/subject-case/repository/subject-case.repository';

export class InMemorySubjectCaseRepository implements SubjectCaseRepository {
  readonly store = new Map<string, SubjectCase>();

  save(subjectCase: SubjectCase): Promise<void> {
    this.store.set(subjectCase.id, subjectCase);
    return Promise.resolve();
  }

  existsBySubjectAndCase(subjectId: string, caseId: string): Promise<boolean> {
    for (const link of this.store.values()) {
      if (link.subjectId === subjectId && link.caseId === caseId) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }
}
