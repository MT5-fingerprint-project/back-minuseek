import { ListInvestigationCasesHandler } from './list-investigation-cases.handler';
import { ListInvestigationCasesQuery } from './list-investigation-cases.query';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

describe('ListInvestigationCasesHandler', () => {
  let handler: ListInvestigationCasesHandler;
  let repo: InMemoryInvestigationCaseRepository;

  beforeEach(() => {
    repo = new InMemoryInvestigationCaseRepository();
    handler = new ListInvestigationCasesHandler(repo);
  });

  it('retourne une liste vide si aucun dossier', async () => {
    const result = await handler.execute(new ListInvestigationCasesQuery());
    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });

  it('retourne tous les dossiers sans filtre', async () => {
    await repo.save(
      InvestigationCase.open({
        id: '1',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-001',
      }),
    );
    await repo.save(
      InvestigationCase.open({
        id: '2',
        caseNumber: 'AFF-002',
        pvNumber: 'PV-002',
      }),
    );

    const result = await handler.execute(new ListInvestigationCasesQuery());
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(2);
  });

  it('filtre par statut', async () => {
    await repo.save(
      InvestigationCase.open({
        id: '1',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-001',
      }),
    );

    const result = await handler.execute(
      new ListInvestigationCasesQuery(InvestigationCaseStatusEnum.CLOSED),
    );
    expect(result.data).toHaveLength(0);
  });

  it('applique la pagination', async () => {
    for (let i = 1; i <= 5; i++) {
      await repo.save(
        InvestigationCase.open({
          id: `${i}`,
          caseNumber: `AFF-00${i}`,
          pvNumber: `PV-00${i}`,
        }),
      );
    }

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, 2, 2),
    );
    expect(result.data).toHaveLength(2);
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.page).toBe(2);
  });
});
