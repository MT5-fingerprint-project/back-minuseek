import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import { InvestigationCaseRepository } from '../../domain/investigation-case/repository/investigation-case.repository';

export class InMemoryInvestigationCaseRepository implements InvestigationCaseRepository {
  readonly store = new Map<string, InvestigationCase>();

  save(c: InvestigationCase): Promise<void> {
    this.store.set(c.id, c);
    return Promise.resolve();
  }

  existsByCaseNumber(caseNumber: string): Promise<boolean> {
    for (const c of this.store.values()) {
      if (c.caseNumber === caseNumber) return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}
