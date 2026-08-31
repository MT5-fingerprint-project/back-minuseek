import { CaseAccessService } from '../../../../access/application/case-access.service';
import { InMemoryCaseAccessReader } from '../../../../access/infrastructure/persistence/in-memory-case-access.reader';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { ListInvestigationCasesHandler } from './list-investigation-cases.handler';
import { ListInvestigationCasesQuery } from './list-investigation-cases.query';
import { InMemoryInvestigationCaseReader } from '../../../infrastructure/persistence/in-memory-investigation-case.reader';
import { InvestigationCaseReadModel } from './investigation-case-read-model';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

const MARIE = { id: 'marie', role: UserRoleEnum.OPERATOR };
const NADIA = { id: 'nadia', role: UserRoleEnum.ADMIN };

const makeCase = (
  overrides: Partial<InvestigationCaseReadModel> = {},
): InvestigationCaseReadModel => ({
  id: 'id-1',
  caseNumber: 'AFF-001',
  pvNumber: 'PV-001',
  description: null,
  status: InvestigationCaseStatusEnum.OPEN,
  operator: null,
  expertise: null,
  requestDate: null,
  requesterQuality: null,
  requesterName: null,
  requesterService: null,
  offenseNature: null,
  offenseLocation: null,
  offenseDateFrom: null,
  offenseDateTo: null,
  interventionDate: null,
  caseAgainst: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('ListInvestigationCasesHandler', () => {
  let handler: ListInvestigationCasesHandler;
  let reader: InMemoryInvestigationCaseReader;

  // Marie est opérateur de « 1 » et de « 2 » ; tout le reste appartient à
  // quelqu'un d'autre.
  const buildHandler = (
    operators: { caseId: string; userId: string }[] = [
      { caseId: '1', userId: MARIE.id },
      { caseId: '2', userId: MARIE.id },
    ],
  ) =>
    new ListInvestigationCasesHandler(
      reader,
      new CaseAccessService(new InMemoryCaseAccessReader({ operators })),
    );

  beforeEach(() => {
    reader = new InMemoryInvestigationCaseReader();
    handler = buildHandler();
  });

  it('retourne une liste vide si aucune affaire', async () => {
    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, undefined, undefined, NADIA),
    );
    expect(result.data).toHaveLength(0);
    expect(result.meta.itemCount).toBe(0);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('retourne toutes les affaires sans filtre', async () => {
    reader.store.push(makeCase({ id: '1', caseNumber: 'AFF-001' }));
    reader.store.push(makeCase({ id: '2', caseNumber: 'AFF-002' }));

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, undefined, undefined, NADIA),
    );
    expect(result.data).toHaveLength(2);
    expect(result.meta.itemCount).toBe(2);
  });

  it('filtre par statut', async () => {
    reader.store.push(
      makeCase({ id: '1', status: InvestigationCaseStatusEnum.OPEN }),
    );

    const result = await handler.execute(
      new ListInvestigationCasesQuery(
        InvestigationCaseStatusEnum.CLOSED,
        undefined,
        undefined,
        NADIA,
      ),
    );
    expect(result.data).toHaveLength(0);
  });

  it('applique la pagination et calcule la meta', async () => {
    for (let i = 1; i <= 5; i++) {
      reader.store.push(makeCase({ id: `${i}`, caseNumber: `AFF-00${i}` }));
    }

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, 2, 2, NADIA),
    );
    expect(result.data).toHaveLength(2);
    expect(result.meta.pageCount).toBe(3);
    expect(result.meta.page).toBe(2);
    expect(result.meta.hasPreviousPage).toBe(true);
    expect(result.meta.hasNextPage).toBe(true);
  });

  it('ne rend à un opérateur que les affaires dont il est titulaire', async () => {
    reader.store.push(makeCase({ id: '1', caseNumber: 'AFF-001' }));
    reader.store.push(makeCase({ id: '2', caseNumber: 'AFF-002' }));
    reader.store.push(makeCase({ id: '3', caseNumber: 'AFF-003' }));

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, undefined, undefined, MARIE),
    );

    expect(result.data.map((affaire) => affaire.id).sort()).toEqual(['1', '2']);
    // Le compte total suit le filtre, sinon la pagination annonce des pages vides.
    expect(result.meta.itemCount).toBe(2);
  });

  it('rend au responsable de service toutes les affaires, sans en être titulaire', async () => {
    reader.store.push(makeCase({ id: '1' }));
    reader.store.push(makeCase({ id: '3' }));

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, undefined, undefined, NADIA),
    );

    expect(result.meta.itemCount).toBe(2);
  });

  it('ne rend rien à un jeton sans compte dans le service', async () => {
    reader.store.push(makeCase({ id: '1' }));

    const result = await handler.execute(new ListInvestigationCasesQuery());

    expect(result.data).toEqual([]);
    expect(result.meta.itemCount).toBe(0);
  });

  it("ne rend rien à un opérateur qui n'a aucune affaire", async () => {
    reader.store.push(makeCase({ id: '1' }));
    const orphelin = buildHandler([]);

    const result = await orphelin.execute(
      new ListInvestigationCasesQuery(undefined, undefined, undefined, MARIE),
    );

    expect(result.data).toEqual([]);
  });

  it('départage par identifiant deux affaires ouvertes dans la même seconde', async () => {
    const openedAt = new Date('2026-02-01');
    reader.store.push(makeCase({ id: 'aa', createdAt: openedAt }));
    reader.store.push(makeCase({ id: 'cc', createdAt: openedAt }));
    reader.store.push(makeCase({ id: 'bb', createdAt: openedAt }));

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, undefined, undefined, NADIA),
    );

    expect(result.data.map((affaire) => affaire.id)).toEqual([
      'aa',
      'bb',
      'cc',
    ]);
  });

  // Les affaires sont poussées à l'envers de l'ordre attendu : sans départage,
  // un tri stable rendrait « bb » page 1 et « aa » page 2.
  it('ne rend pas deux fois la même affaire sur deux pages successives', async () => {
    const openedAt = new Date('2026-02-01');
    reader.store.push(makeCase({ id: 'bb', createdAt: openedAt }));
    reader.store.push(makeCase({ id: 'aa', createdAt: openedAt }));

    const premiere = await handler.execute(
      new ListInvestigationCasesQuery(undefined, 1, 1, NADIA),
    );
    const seconde = await handler.execute(
      new ListInvestigationCasesQuery(undefined, 2, 1, NADIA),
    );

    const vues = [...premiere.data, ...seconde.data].map(
      (affaire) => affaire.id,
    );
    expect(vues).toEqual(['aa', 'bb']);
  });

  it('trie par createdAt décroissant', async () => {
    reader.store.push(
      makeCase({ id: 'old', createdAt: new Date('2026-01-01') }),
    );
    reader.store.push(
      makeCase({ id: 'recent', createdAt: new Date('2026-03-01') }),
    );

    const result = await handler.execute(
      new ListInvestigationCasesQuery(undefined, undefined, undefined, NADIA),
    );
    expect(result.data[0].id).toBe('recent');
    expect(result.data[1].id).toBe('old');
  });
});
