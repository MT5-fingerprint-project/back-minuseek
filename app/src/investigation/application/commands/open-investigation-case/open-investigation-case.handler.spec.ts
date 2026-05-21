import { OpenInvestigationCaseHandler } from './open-investigation-case.handler';
import { OpenInvestigationCaseCommand } from './open-investigation-case.command';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case-status.vo';
import { CaseNumberAlreadyExistsError } from '../../../domain/investigation-case';

describe('OpenInvestigationCaseHandler', () => {
  let handler: OpenInvestigationCaseHandler;
  let repo: InMemoryInvestigationCaseRepository;

  beforeEach(() => {
    repo = new InMemoryInvestigationCaseRepository();
    handler = new OpenInvestigationCaseHandler(repo);
  });

  it('retourne un UUID', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand('AFF-001', 'PV-2024-001'),
    );
    expect(typeof id).toBe('string');
    expect(id).toHaveLength(36); // format UUID
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
