import { InvestigationCaseStatusEnum } from '../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InvestigationCaseReadModel } from '../../application/queries/list-investigation-cases/investigation-case-read-model';
import { InvestigationCaseReader } from '../../application/queries/list-investigation-cases/investigation-case.reader';

export class InMemoryInvestigationCaseReader implements InvestigationCaseReader {
  readonly store: InvestigationCaseReadModel[] = [];

  findAll(
    filters: { status?: InvestigationCaseStatusEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }> {
    let all = [...this.store];

    if (filters.status) {
      const status: string = filters.status;
      all = all.filter((c) => c.status === status);
    }

    all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return Promise.resolve({
      items: all.slice(pagination.skip, pagination.skip + pagination.take),
      total: all.length,
    });
  }
}
