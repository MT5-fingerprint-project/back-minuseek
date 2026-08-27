import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import {
  InvestigationCaseFilters,
  InvestigationCaseReader,
} from '../../application/queries/list-investigation-cases/investigation-case.reader';

export class InMemoryInvestigationCaseReader implements InvestigationCaseReader {
  readonly store: InvestigationCaseReadModel[] = [];

  findAll(
    filters: InvestigationCaseFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }> {
    let all = [...this.store];

    if (filters.status) {
      const status: string = filters.status;
      all = all.filter((c) => c.status === status);
    }

    if (filters.caseIds !== null) {
      const visible = new Set(filters.caseIds);
      all = all.filter((c) => visible.has(c.id));
    }

    // Même ordre que `prisma-investigation-case.reader.ts`, départage compris :
    // sans lui le fake pagine mieux que la vraie requête.
    all.sort(
      (left, right) =>
        right.createdAt.getTime() - left.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    );

    return Promise.resolve({
      items: all.slice(pagination.skip, pagination.skip + pagination.take),
      total: all.length,
    });
  }

  findById(id: string): Promise<InvestigationCaseReadModel | null> {
    return Promise.resolve(this.store.find((c) => c.id === id) ?? null);
  }
}
