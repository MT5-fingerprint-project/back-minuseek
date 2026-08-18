import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { OpenInvestigationCaseHandler } from './open-investigation-case.handler';
import { OpenInvestigationCaseCommand } from './open-investigation-case.command';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { CaseNumberAlreadyExistsError } from '../../../domain/investigation-case/errors/case-number-already-exists.error';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';

describe('OpenInvestigationCaseHandler', () => {
  let handler: OpenInvestigationCaseHandler;
  let repo: InMemoryInvestigationCaseRepository;
  let idGenerator: IdGenerator;
  let transactionRunner: InMemoryTransactionRunner;

  beforeEach(() => {
    repo = new InMemoryInvestigationCaseRepository();
    idGenerator = { generate: jest.fn().mockReturnValue('test-uuid') };
    transactionRunner = new InMemoryTransactionRunner();
    handler = new OpenInvestigationCaseHandler(
      repo,
      idGenerator,
      transactionRunner,
    );
  });

  it("retourne l'id généré", async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(EXPERT_ACTOR, 'AFF-001', 'PV-2024-001'),
    );
    expect(id).toBe('test-uuid');
  });

  it('persiste le case dans le repository', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(EXPERT_ACTOR, 'AFF-001', 'PV-2024-001'),
    );
    const saved = repo.store.get(id);
    expect(saved).not.toBeNull();
    expect(saved!.caseNumber).toBe('AFF-001');
  });

  it("persiste à l'intérieur d'une frontière transactionnelle", async () => {
    await handler.execute(
      new OpenInvestigationCaseCommand(EXPERT_ACTOR, 'AFF-001', 'PV-2024-001'),
    );
    expect(transactionRunner.runCount).toBe(1);
  });

  it('le case créé a le status OPEN', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(EXPERT_ACTOR, 'AFF-001', 'PV-2024-001'),
    );
    const saved = repo.store.get(id);
    expect(saved!.status).toBe(InvestigationCaseStatusEnum.OPEN);
  });

  it('lève CaseNumberAlreadyExistsError si caseNumber déjà utilisé', async () => {
    await handler.execute(
      new OpenInvestigationCaseCommand(EXPERT_ACTOR, 'AFF-001', 'PV-2024-001'),
    );
    await expect(
      handler.execute(
        new OpenInvestigationCaseCommand(
          EXPERT_ACTOR,
          'AFF-001',
          'PV-2024-002',
        ),
      ),
    ).rejects.toThrow(CaseNumberAlreadyExistsError);
  });
});
