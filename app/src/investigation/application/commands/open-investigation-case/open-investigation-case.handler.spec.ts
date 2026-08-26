import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { OpenInvestigationCaseHandler } from './open-investigation-case.handler';
import { OpenInvestigationCaseCommand } from './open-investigation-case.command';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { CaseNumberAlreadyExistsError } from '../../../domain/investigation-case/errors/case-number-already-exists.error';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';

const MARIE = 'user-marie';

describe('OpenInvestigationCaseHandler', () => {
  let handler: OpenInvestigationCaseHandler;
  let repo: InMemoryInvestigationCaseRepository;
  let idGenerator: IdGenerator;
  let auditTrail: InMemoryAuditTrailAppender;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryInvestigationCaseRepository(auditTrail);
    idGenerator = { generate: jest.fn().mockReturnValue('test-uuid') };
    handler = new OpenInvestigationCaseHandler(repo, idGenerator);
  });

  it("retourne l'id généré", async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(
        EXPERT_ACTOR,
        MARIE,
        'AFF-001',
        'PV-2024-001',
      ),
    );
    expect(id).toBe('test-uuid');
  });

  it('persiste le case dans le repository', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(
        EXPERT_ACTOR,
        MARIE,
        'AFF-001',
        'PV-2024-001',
      ),
    );
    const saved = repo.store.get(id);
    expect(saved).not.toBeNull();
    expect(saved!.caseNumber).toBe('AFF-001');
  });

  it('le case créé a le status OPEN', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(
        EXPERT_ACTOR,
        MARIE,
        'AFF-001',
        'PV-2024-001',
      ),
    );
    const saved = repo.store.get(id);
    expect(saved!.status).toBe(InvestigationCaseStatusEnum.OPEN);
  });

  it('chaîne un CASE_OPENED rattaché au dossier créé', async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(
        EXPERT_ACTOR,
        MARIE,
        'AFF-001',
        'PV-2024-001',
        'Cambriolage rue des Lilas',
      ),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.CASE_OPENED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe(id);
    expect(event.payload).toEqual({
      caseNumber: 'AFF-001',
      pvNumber: 'PV-2024-001',
      operatorUserId: MARIE,
    });
  });

  it("n'écrit aucun événement quand le numéro de dossier est déjà pris", async () => {
    await handler.execute(
      new OpenInvestigationCaseCommand(
        EXPERT_ACTOR,
        MARIE,
        'AFF-001',
        'PV-2024-001',
      ),
    );

    await expect(
      handler.execute(
        new OpenInvestigationCaseCommand(
          EXPERT_ACTOR,
          MARIE,
          'AFF-001',
          'PV-2024-002',
        ),
      ),
    ).rejects.toThrow(CaseNumberAlreadyExistsError);
    expect(auditTrail.events).toHaveLength(1);
  });

  it('lève CaseNumberAlreadyExistsError si caseNumber déjà utilisé', async () => {
    await handler.execute(
      new OpenInvestigationCaseCommand(
        EXPERT_ACTOR,
        MARIE,
        'AFF-001',
        'PV-2024-001',
      ),
    );
    await expect(
      handler.execute(
        new OpenInvestigationCaseCommand(
          EXPERT_ACTOR,
          MARIE,
          'AFF-001',
          'PV-2024-002',
        ),
      ),
    ).rejects.toThrow(CaseNumberAlreadyExistsError);
  });

  it("fait de l'auteur de l'ouverture l'opérateur du dossier", async () => {
    const id = await handler.execute(
      new OpenInvestigationCaseCommand(
        EXPERT_ACTOR,
        MARIE,
        'AFF-001',
        'PV-2024-001',
      ),
    );

    expect(repo.store.get(id)!.operatorUserId).toBe(MARIE);
  });
});
