import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import { InvestigationCaseReader } from '../../application/queries/list-investigation-cases/investigation-case.reader';

export class InMemoryInvestigationCaseReader implements InvestigationCaseReader {
  readonly store: InvestigationCaseReadModel[] = [];

  findAll(
    filters: { status?: InvestigationCaseStatusEnum; operatorId?: string },
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }> {
    let all = [...this.store];

    if (filters.status) {
      const status: string = filters.status;
      all = all.filter((c) => c.status === status);
    }

    if (filters.operatorId) {
      all = all.filter((c) => c.operatorId === filters.operatorId);
    }

    // Même contrat de tri que PrismaInvestigationCaseReader.
    all.sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
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
