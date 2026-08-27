import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { OperatorChangeNotAllowedError } from '../../../domain/investigation-case/errors/operator-change-not-allowed.error';
import { DisabledOperatorError } from '../../../domain/investigation-case/errors/disabled-operator.error';
import { UnknownOperatorError } from '../../../domain/investigation-case/errors/unknown-operator.error';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InMemoryServiceUserDirectory } from '../../../infrastructure/persistence/in-memory-service-user.directory';
import { ChangeCaseOperatorCommand } from './change-case-operator.command';
import { ChangeCaseOperatorHandler } from './change-case-operator.handler';

const CASE_ID = 'case-1';
const MARIE = 'user-marie';
const PIERRE = 'user-pierre';
const CHEF = 'user-chef';
const PARTI = 'user-parti';

const operator = (id: string) => ({ id, role: UserRoleEnum.OPERATOR });
const serviceManager = (id: string) => ({ id, role: UserRoleEnum.ADMIN });

describe('ChangeCaseOperatorHandler', () => {
  let handler: ChangeCaseOperatorHandler;
  let repo: InMemoryInvestigationCaseRepository;
  let directory: InMemoryServiceUserDirectory;
  let auditTrail: InMemoryAuditTrailAppender;

  function seedCase(status = InvestigationCaseStatusEnum.OPEN) {
    repo.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2024-001',
        description: null,
        status,
        operatorUserId: MARIE,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      }),
    );
  }

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryInvestigationCaseRepository(auditTrail);
    directory = new InMemoryServiceUserDirectory([
      { id: MARIE, disabled: false, firstName: 'Marie', lastName: 'Curie' },
      { id: PIERRE, disabled: false, firstName: 'Pierre', lastName: 'Martin' },
      { id: CHEF, disabled: false, firstName: 'Solène', lastName: 'Roy' },
      { id: PARTI, disabled: true, firstName: 'Luc', lastName: 'Bonnet' },
    ]);
    handler = new ChangeCaseOperatorHandler(repo, directory);
    seedCase();
  });

  it("confie le dossier au collègue désigné par l'opérateur en place", async () => {
    await handler.execute(
      new ChangeCaseOperatorCommand(
        EXPERT_ACTOR,
        operator(MARIE),
        CASE_ID,
        PIERRE,
      ),
    );

    expect(repo.store.get(CASE_ID)!.operatorUserId).toBe(PIERRE);
  });

  it('laisse le responsable de service confier un dossier dont il n’est pas l’opérateur', async () => {
    await handler.execute(
      new ChangeCaseOperatorCommand(
        EXPERT_ACTOR,
        serviceManager(CHEF),
        CASE_ID,
        PIERRE,
      ),
    );

    expect(repo.store.get(CASE_ID)!.operatorUserId).toBe(PIERRE);
  });

  it('accepte de confier le dossier à un responsable de service', async () => {
    await handler.execute(
      new ChangeCaseOperatorCommand(
        EXPERT_ACTOR,
        operator(MARIE),
        CASE_ID,
        CHEF,
      ),
    );

    expect(repo.store.get(CASE_ID)!.operatorUserId).toBe(CHEF);
  });

  it('chaîne un CASE_OPERATOR_CHANGED qui nomme les deux comptes', async () => {
    await handler.execute(
      new ChangeCaseOperatorCommand(
        EXPERT_ACTOR,
        operator(MARIE),
        CASE_ID,
        PIERRE,
      ),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.CASE_OPERATOR_CHANGED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe(CASE_ID);
    expect(event.payload).toEqual({
      previousOperatorUserId: MARIE,
      newOperatorUserId: PIERRE,
    });
  });

  it.each([
    [
      'un compte qui n’est ni l’opérateur en place ni responsable de service',
      InvestigationCaseStatusEnum.OPEN,
      () =>
        new ChangeCaseOperatorCommand(
          EXPERT_ACTOR,
          operator(PIERRE),
          CASE_ID,
          PIERRE,
        ),
      OperatorChangeNotAllowedError,
    ],
    [
      'un compte qui n’existe pas',
      InvestigationCaseStatusEnum.OPEN,
      () =>
        new ChangeCaseOperatorCommand(
          EXPERT_ACTOR,
          operator(MARIE),
          CASE_ID,
          'user-fantome',
        ),
      UnknownOperatorError,
    ],
    [
      'un compte désactivé',
      InvestigationCaseStatusEnum.OPEN,
      () =>
        new ChangeCaseOperatorCommand(
          EXPERT_ACTOR,
          operator(MARIE),
          CASE_ID,
          PARTI,
        ),
      DisabledOperatorError,
    ],
    [
      'une affaire qui n’existe pas',
      InvestigationCaseStatusEnum.OPEN,
      () =>
        new ChangeCaseOperatorCommand(
          EXPERT_ACTOR,
          operator(MARIE),
          'case-fantome',
          PIERRE,
        ),
      CaseNotFoundError,
    ],
    [
      'une affaire close',
      InvestigationCaseStatusEnum.CLOSED,
      () =>
        new ChangeCaseOperatorCommand(
          EXPERT_ACTOR,
          operator(MARIE),
          CASE_ID,
          PIERRE,
        ),
      CaseClosedError,
    ],
  ])(
    'refuse %s sans chaîner d’acte ni changer l’opérateur',
    async (_refus, status, command, expectedError) => {
      repo.store.clear();
      seedCase(status);

      await expect(handler.execute(command())).rejects.toThrow(expectedError);

      expect(auditTrail.events).toHaveLength(0);
      expect(repo.store.get(CASE_ID)!.operatorUserId).toBe(MARIE);
    },
  );

  it('distingue un compte désactivé d’un compte inconnu', async () => {
    await expect(
      handler.execute(
        new ChangeCaseOperatorCommand(
          EXPERT_ACTOR,
          operator(MARIE),
          CASE_ID,
          PARTI,
        ),
      ),
    ).rejects.toThrow(/désactivé/);
  });

  it('oppose à un tiers le refus d’autorisation avant même de lire l’annuaire', async () => {
    await expect(
      handler.execute(
        new ChangeCaseOperatorCommand(
          EXPERT_ACTOR,
          operator(PIERRE),
          CASE_ID,
          PARTI,
        ),
      ),
    ).rejects.toThrow(OperatorChangeNotAllowedError);
  });

  // Un compte désactivé n'obtient plus de jeton : le demandeur ne peut pas
  // l'être, seule la cible de la désignation est à contrôler.
  it('ne chaîne aucun acte sur deux refus d’affilée', async () => {
    const command = () =>
      new ChangeCaseOperatorCommand(
        EXPERT_ACTOR,
        operator(MARIE),
        CASE_ID,
        PARTI,
      );

    await expect(handler.execute(command())).rejects.toThrow(
      DisabledOperatorError,
    );
    await expect(handler.execute(command())).rejects.toThrow(
      DisabledOperatorError,
    );

    expect(auditTrail.events).toHaveLength(0);
  });
});
