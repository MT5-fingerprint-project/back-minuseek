import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { InvalidCaseTransitionError } from '../../../domain/investigation-case/errors/invalid-case-transition.error';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { ReopenInvestigationCaseCommand } from './reopen-investigation-case.command';
import { ReopenInvestigationCaseHandler } from './reopen-investigation-case.handler';

const CASE_ID = 'case-1';
const REASON = 'Réquisition complémentaire du 12 septembre 2026';

describe('ReopenInvestigationCaseHandler', () => {
  let handler: ReopenInvestigationCaseHandler;
  let repo: InMemoryInvestigationCaseRepository;
  let auditTrail: InMemoryAuditTrailAppender;

  const seedCase = (status: InvestigationCaseStatusEnum): void => {
    repo.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2026-001',
        description: null,
        status,
        operatorUserId: 'user-marie',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      }),
    );
  };

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryInvestigationCaseRepository(auditTrail);
    handler = new ReopenInvestigationCaseHandler(repo);
  });

  it('rouvre une affaire close en travail en cours', async () => {
    seedCase(InvestigationCaseStatusEnum.CLOSED);

    await handler.execute(
      new ReopenInvestigationCaseCommand(EXPERT_ACTOR, CASE_ID, REASON),
    );

    expect((await repo.findById(CASE_ID))?.status).toBe(
      InvestigationCaseStatusEnum.IN_PROGRESS,
    );
  });

  it('recopie le motif de la réouverture dans la charge utile', async () => {
    seedCase(InvestigationCaseStatusEnum.CLOSED);

    await handler.execute(
      new ReopenInvestigationCaseCommand(EXPERT_ACTOR, CASE_ID, REASON),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.CASE_STATUS_CHANGED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe(CASE_ID);
    expect(event.payload).toEqual({
      previousStatus: 'CLOSED',
      newStatus: 'IN_PROGRESS',
      reason: REASON,
    });
  });

  it("refuse de rouvrir une affaire qui n'est pas close, sans rien inscrire", async () => {
    seedCase(InvestigationCaseStatusEnum.OPEN);

    await expect(
      handler.execute(
        new ReopenInvestigationCaseCommand(EXPERT_ACTOR, CASE_ID, REASON),
      ),
    ).rejects.toBeInstanceOf(InvalidCaseTransitionError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it("n'inscrit rien sur une affaire inconnue", async () => {
    await expect(
      handler.execute(
        new ReopenInvestigationCaseCommand(EXPERT_ACTOR, 'introuvable', REASON),
      ),
    ).rejects.toBeInstanceOf(CaseNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });
});
