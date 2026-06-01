import { InvestigationCase } from '../../domain/investigation-case/entity/investigation-case';
import { InvestigationCaseRepository } from '../../domain/investigation-case/repository/investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';

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

  findAll(
    filters: { status?: InvestigationCaseStatusEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ cases: InvestigationCase[]; total: number }> {
    let all = [...this.store.values()];

    if (filters.status) {
      all = all.filter((c) => c.status === filters.status);
    }

    return Promise.resolve({
      cases: all.slice(pagination.skip, pagination.skip + pagination.take),
      total: all.length,
    });
  }
}
