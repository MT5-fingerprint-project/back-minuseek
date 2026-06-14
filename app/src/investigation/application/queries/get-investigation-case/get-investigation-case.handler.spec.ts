import { GetInvestigationCaseHandler } from './get-investigation-case.handler';
import { GetInvestigationCaseQuery } from './get-investigation-case.query';
import { InMemoryInvestigationCaseReader } from '../../../infrastructure/persistence/in-memory-investigation-case.reader';
import { InvestigationCaseReadModel } from '../list-investigation-cases/investigation-case-read-model';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';

const makeCase = (
  overrides: Partial<InvestigationCaseReadModel> = {},
): InvestigationCaseReadModel => ({
  id: 'id-1',
  caseNumber: 'AFF-001',
  pvNumber: 'PV-001',
  description: null,
  status: InvestigationCaseStatusEnum.OPEN,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('GetInvestigationCaseHandler', () => {
  let handler: GetInvestigationCaseHandler;
  let reader: InMemoryInvestigationCaseReader;

  beforeEach(() => {
    reader = new InMemoryInvestigationCaseReader();
    handler = new GetInvestigationCaseHandler(reader);
  });

  it("retourne le détail d'une affaire existante", async () => {
    reader.store.push(
      makeCase({
        id: 'id-1',
        caseNumber: 'AFF-001',
        pvNumber: 'PV-001',
        description: 'Une affaire de test',
        status: InvestigationCaseStatusEnum.IN_PROGRESS,
      }),
    );

    const {
      id,
      caseNumber,
      pvNumber,
      description,
      status,
      createdAt,
      updatedAt,
    } = await handler.execute(new GetInvestigationCaseQuery('id-1'));

    expect(id).toBe('id-1');
    expect(caseNumber).toBe('AFF-001');
    expect(pvNumber).toBe('PV-001');
    expect(description).toBe('Une affaire de test');
    expect(status).toBe(InvestigationCaseStatusEnum.IN_PROGRESS);
    expect(createdAt).toBeInstanceOf(Date);
    expect(updatedAt).toBeInstanceOf(Date);
  });

  it("lève une CaseNotFoundError si l'affaire n'existe pas", async () => {
    await expect(
      handler.execute(new GetInvestigationCaseQuery('id-inexistant')),
    ).rejects.toThrow(CaseNotFoundError);
  });

  it('retourne la bonne affaire parmi plusieurs', async () => {
    reader.store.push(makeCase({ id: 'id-1', caseNumber: 'AFF-001' }));
    reader.store.push(makeCase({ id: 'id-2', caseNumber: 'AFF-002' }));

    const { id, caseNumber } = await handler.execute(
      new GetInvestigationCaseQuery('id-2'),
    );

    expect(id).toBe('id-2');
    expect(caseNumber).toBe('AFF-002');
  });
});
