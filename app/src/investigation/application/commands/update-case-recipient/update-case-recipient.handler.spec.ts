import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  InvestigationCase,
  NO_JUDICIAL_HEADER,
  NO_RECIPIENT,
  StatedRecipient,
} from '../../../domain/investigation-case/entity/investigation-case';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { UpdateCaseRecipientCommand } from './update-case-recipient.command';
import { UpdateCaseRecipientHandler } from './update-case-recipient.handler';

const CASE_ID = 'case-1';
const AUTHORITY =
  'Le Commissaire Général, chef du 3e District de Police Judiciaire';

const UN_DESTINATAIRE: StatedRecipient = {
  authority: AUTHORITY,
  attentionQuality: 'Brigadier-Chef de Police',
  attentionName: 'MARCHAND Claire',
};

describe('UpdateCaseRecipientHandler', () => {
  let repo: InMemoryInvestigationCaseRepository;
  let auditTrail: InMemoryAuditTrailAppender;
  let handler: UpdateCaseRecipientHandler;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryInvestigationCaseRepository(auditTrail);
    repo.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2024-001',
        description: null,
        ...NO_JUDICIAL_HEADER,
        ...NO_RECIPIENT,
        status: InvestigationCaseStatusEnum.OPEN,
        operatorUserId: 'user-marie',
        closedAt: null,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      }),
    );
    handler = new UpdateCaseRecipientHandler(repo);
  });

  const stored = () => repo.store.get(CASE_ID)!;
  const update = (recipient: StatedRecipient, caseId = CASE_ID) =>
    new UpdateCaseRecipientCommand(EXPERT_ACTOR, caseId, recipient);

  it('affecte les trois lignes du destinataire au dossier', async () => {
    await handler.execute(update(UN_DESTINATAIRE));

    expect(stored().recipient).toEqual({
      recipientAuthority: AUTHORITY,
      recipientAttentionQuality: 'Brigadier-Chef de Police',
      recipientAttentionName: 'MARCHAND Claire',
    });
  });

  it('écrase le bloc entier, remises à null comprises', async () => {
    await handler.execute(update(UN_DESTINATAIRE));

    await handler.execute(
      update({ authority: 'Le Procureur de la République' }),
    );

    expect(stored().recipient).toEqual({
      recipientAuthority: 'Le Procureur de la République',
      recipientAttentionQuality: null,
      recipientAttentionName: null,
    });
  });

  it('inscrit un CASE_UPDATED par appel réussi, avec les trois valeurs', async () => {
    await handler.execute(update(UN_DESTINATAIRE));

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.CASE_UPDATED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe(CASE_ID);
    expect(event.payload).toStrictEqual({
      changes: {
        recipientAuthority: AUTHORITY,
        recipientAttentionQuality: 'Brigadier-Chef de Police',
        recipientAttentionName: 'MARCHAND Claire',
      },
    });
  });

  it('refuse un dossier inconnu sans inscrire aucun acte', async () => {
    await expect(
      handler.execute(update(UN_DESTINATAIRE, 'case-fantome')),
    ).rejects.toThrow(CaseNotFoundError);

    expect(auditTrail.events).toHaveLength(0);
    expect(stored().recipient).toEqual(NO_RECIPIENT);
  });
});
