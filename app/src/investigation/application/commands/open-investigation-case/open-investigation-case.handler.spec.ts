import { OpenInvestigationCaseHandler } from './open-investigation-case.handler';
import { OpenInvestigationCaseCommand } from './open-investigation-case.command';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { CaseNumberAlreadyExistsError } from '../../../domain/investigation-case/errors/case-number-already-exists.error';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';

describe('OpenInvestigationCaseHandler', () => {
  let handler: OpenInvestigationCaseHandler;
  let repo: InMemoryInvestigationCaseRepository;
  let idGenerator: IdGenerator;

  beforeEach(() => {
    repo = new InMemoryInvestigationCaseRepository();
    idGenerator = { generate: jest.fn().mockReturnValue('test-uuid') };
    handler = new OpenInvestigationCaseHandler(repo, idGenerator);
  });

  it("retourne l'id généré", async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand('AFF-001', 'PV-2024-001'),
    );
    expect(id).toBe('test-uuid');
  });

  it('persiste le case dans le repository', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand('AFF-001', 'PV-2024-001'),
    );
    const saved = repo.store.get(id);
    expect(saved).not.toBeNull();
    expect(saved!.caseNumber).toBe('AFF-001');
  });

  it('le case créé a le status OPEN', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand('AFF-001', 'PV-2024-001'),
    );
    const saved = repo.store.get(id);
    expect(saved!.status).toBe(InvestigationCaseStatusEnum.OPEN);
  });

  it("rattache l'utilisateur créateur quand il est fourni", async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(
        'AFF-001',
        'PV-2024-001',
        undefined,
        'user-1',
      ),
    );
    expect(repo.store.get(id)!.userId).toBe('user-1');
  });

  it('laisse userId à null sans utilisateur résolu', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand('AFF-001', 'PV-2024-001'),
    );
    expect(repo.store.get(id)!.userId).toBeNull();
  });

  it('lève CaseNumberAlreadyExistsError si caseNumber déjà utilisé', async () => {
    await handler.execute(
      new OpenInvestigationCaseCommand('AFF-001', 'PV-2024-001'),
    );
    await expect(
      handler.execute(
        new OpenInvestigationCaseCommand('AFF-001', 'PV-2024-002'),
      ),
    ).rejects.toThrow(CaseNumberAlreadyExistsError);
  });
});
