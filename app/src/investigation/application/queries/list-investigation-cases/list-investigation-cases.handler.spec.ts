import { ListInvestigationCasesHandler } from './list-investigation-cases.handler';
import { ListInvestigationCasesQuery } from './list-investigation-cases.query';
import { InMemoryInvestigationCaseReader } from '../../../infrastructure/persistence/in-memory-investigation-case.reader';
import { InvestigationCaseReadModel } from './investigation-case-read-model';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

const makeCase = (
  overrides: Partial<InvestigationCaseReadModel> = {},
): InvestigationCaseReadModel => ({
  id: 'id-1',
  caseNumber: 'AFF-001',
  pvNumber: 'PV-001',
  description: null,
  status: InvestigationCaseStatusEnum.OPEN,
  operatorId: 'operator-1',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('ListInvestigationCasesHandler', () => {
  let handler: ListInvestigationCasesHandler;
  let reader: InMemoryInvestigationCaseReader;

  beforeEach(() => {
    reader = new InMemoryInvestigationCaseReader();
    handler = new ListInvestigationCasesHandler(reader);
  });

  it('retourne une liste vide si aucune affaire', async () => {
    const result = await handler.execute(new ListInvestigationCasesQuery());
    expect(result.data).toHaveLength(0);
    expect(result.meta.itemCount).toBe(0);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('retourne toutes les affaires sans filtre', async () => {
    reader.store.push(makeCase({ id: '1', caseNumber: 'AFF-001' }));
    reader.store.push(makeCase({ id: '2', caseNumber: 'AFF-002' }));

    const result = await handler.execute(new ListInvestigationCasesQuery());
    expect(result.data).toHaveLength(2);
    expect(result.meta.itemCount).toBe(2);
  });

  it('filtre par statut', async () => {
    reader.store.push(
      makeCase({ id: '1', status: InvestigationCaseStatusEnum.OPEN }),
    );

    const result = await handler.execute(
      new ListInvestigationCasesQuery(InvestigationCaseStatusEnum.CLOSED),
    );
    expect(result.data).toHaveLength(0);
  });

  it("ne retourne que les affaires assignées à l'opérateur du scope", async () => {
    reader.store.push(makeCase({ id: '1', operatorId: 'operator-1' }));
    reader.store.push(makeCase({ id: '2', operatorId: 'operator-2' }));
    reader.store.push(makeCase({ id: '3', operatorId: null }));

    const result = await handler.execute(
      new ListInvestigationCasesQuery(
        undefined,
        undefined,
        undefined,
        'operator-1',
      ),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');
  });

  it('sans operatorId dans la query, retourne toutes les affaires (scope ADMIN)', async () => {
    reader.store.push(makeCase({ id: '1', operatorId: 'operator-1' }));
    reader.store.push(makeCase({ id: '2', operatorId: 'operator-2' }));

    const result = await handler.execute(new ListInvestigationCasesQuery());
    expect(result.data).toHaveLength(2);
  });

  it('combine le filtre statut et le scope opérateur', async () => {
    reader.store.push(
      makeCase({
        id: '1',
        operatorId: 'operator-1',
        status: InvestigationCaseStatusEnum.OPEN,
      }),
    );
    reader.store.push(
      makeCase({
        id: '2',
        operatorId: 'operator-1',
        status: InvestigationCaseStatusEnum.CLOSED,
      }),
    );
    reader.store.push(
      makeCase({
        id: '3',
        operatorId: 'operator-2',
        status: InvestigationCaseStatusEnum.CLOSED,
      }),
    );

    const result = await handler.execute(
      new ListInvestigationCasesQuery(
        InvestigationCaseStatusEnum.CLOSED,
        undefined,
        undefined,
        'operator-1',
      ),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('2');
  });

  it('applique la pagination et calcule la meta', async () => {
    for (let i = 1; i <= 5; i++) {
      reader.store.push(makeCase({ id: `${i}`, caseNumber: `AFF-00${i}` }));
    }

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, 2, 2),
    );
    expect(result.data).toHaveLength(2);
    expect(result.meta.pageCount).toBe(3);
    expect(result.meta.page).toBe(2);
    expect(result.meta.hasPreviousPage).toBe(true);
    expect(result.meta.hasNextPage).toBe(true);
  });

  it('trie par createdAt décroissant', async () => {
    reader.store.push(
      makeCase({ id: 'old', createdAt: new Date('2026-01-01') }),
    );
    reader.store.push(
      makeCase({ id: 'recent', createdAt: new Date('2026-03-01') }),
    );

    const result = await handler.execute(new ListInvestigationCasesQuery());
    expect(result.data[0].id).toBe('recent');
    expect(result.data[1].id).toBe('old');
  });

  it('départage par id décroissant à createdAt égal (ordre stable)', async () => {
    const sameDate = new Date('2026-01-01');
    reader.store.push(makeCase({ id: 'a', createdAt: sameDate }));
    reader.store.push(makeCase({ id: 'b', createdAt: sameDate }));

    const result = await handler.execute(new ListInvestigationCasesQuery());
    expect(result.data.map((c) => c.id)).toEqual(['b', 'a']);
  });
});
