import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  InvestigationCase,
  NO_JUDICIAL_HEADER,
  NO_RECIPIENT,
} from '../../../domain/investigation-case/entity/investigation-case';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { InvalidCaseTransitionError } from '../../../domain/investigation-case/errors/invalid-case-transition.error';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { ChangeCaseStatusCommand } from './change-case-status.command';
import { ChangeCaseStatusHandler } from './change-case-status.handler';

const CASE_ID = 'case-1';

describe('ChangeCaseStatusHandler', () => {
  let handler: ChangeCaseStatusHandler;
  let repo: InMemoryInvestigationCaseRepository;
  let auditTrail: InMemoryAuditTrailAppender;

  const seedCase = (status: InvestigationCaseStatusEnum): void => {
    repo.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2026-001',
        description: null,
        ...NO_JUDICIAL_HEADER,
        ...NO_RECIPIENT,
        status,
        operatorUserId: 'user-marie',
        closedAt: null,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      }),
    );
  };

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryInvestigationCaseRepository(auditTrail);
    handler = new ChangeCaseStatusHandler(repo);
  });

  it.each([
    [InvestigationCaseStatusEnum.OPEN, InvestigationCaseStatusEnum.IN_PROGRESS],
    [
      InvestigationCaseStatusEnum.IN_PROGRESS,
      InvestigationCaseStatusEnum.UNDER_REVIEW,
    ],
    [
      InvestigationCaseStatusEnum.UNDER_REVIEW,
      InvestigationCaseStatusEnum.IN_PROGRESS,
    ],
  ])('porte une affaire %s en %s', async (from, to) => {
    seedCase(from);

    await handler.execute(
      new ChangeCaseStatusCommand(EXPERT_ACTOR, CASE_ID, to),
    );

    expect((await repo.findById(CASE_ID))?.status).toBe(to);
  });

  it('inscrit le changement de statut au journal', async () => {
    seedCase(InvestigationCaseStatusEnum.OPEN);

    await handler.execute(
      new ChangeCaseStatusCommand(
        EXPERT_ACTOR,
        CASE_ID,
        InvestigationCaseStatusEnum.IN_PROGRESS,
      ),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.CASE_STATUS_CHANGED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe(CASE_ID);
    expect(event.payload).toEqual({
      previousStatus: 'OPEN',
      newStatus: 'IN_PROGRESS',
      reason: null,
    });
  });

  it('refuse une transition interdite sans rien inscrire ni changer', async () => {
    seedCase(InvestigationCaseStatusEnum.OPEN);

    await expect(
      handler.execute(
        new ChangeCaseStatusCommand(
          EXPERT_ACTOR,
          CASE_ID,
          InvestigationCaseStatusEnum.UNDER_REVIEW,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
    expect(auditTrail.events).toHaveLength(0);
    expect((await repo.findById(CASE_ID))?.status).toBe(
      InvestigationCaseStatusEnum.OPEN,
    );
  });

  it('refuse de reprendre le statut déjà en place', async () => {
    seedCase(InvestigationCaseStatusEnum.IN_PROGRESS);

    await expect(
      handler.execute(
        new ChangeCaseStatusCommand(
          EXPERT_ACTOR,
          CASE_ID,
          InvestigationCaseStatusEnum.IN_PROGRESS,
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it("n'inscrit rien sur une affaire inconnue", async () => {
    await expect(
      handler.execute(
        new ChangeCaseStatusCommand(
          EXPERT_ACTOR,
          'introuvable',
          InvestigationCaseStatusEnum.IN_PROGRESS,
        ),
      ),
    ).rejects.toBeInstanceOf(CaseNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });
});
