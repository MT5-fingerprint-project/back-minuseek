import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { CaseVerification } from '../../../domain/case-verification/entity/case-verification';
import { VerificationDecision } from '../../../domain/case-verification/entity/verification-decision';
import { IncompleteVerificationError } from '../../../domain/case-verification/errors/incomplete-verification.error';
import { NotTheVerifierError } from '../../../domain/case-verification/errors/not-the-verifier.error';
import { VerificationNotFoundError } from '../../../domain/case-verification/errors/verification-not-found.error';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import { DecisionOutcomeEnum } from '../../../domain/case-verification/value-objects/decision-outcome.vo';
import { VerificationExploitabilityEnum } from '../../../domain/case-verification/value-objects/verification-exploitability.vo';
import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryCaseExploitationReader } from '../../../infrastructure/persistence/in-memory-case-exploitation.reader';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InMemoryCaseVerificationRepository } from '../../../infrastructure/persistence/in-memory-case-verification.repository';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { InMemoryVerificationDecisionRepository } from '../../../infrastructure/persistence/in-memory-verification-decision.repository';
import { CompleteCaseVerificationCommand } from './complete-case-verification.command';
import { CompleteCaseVerificationHandler } from './complete-case-verification.handler';

const VERIFICATION = 'verification-1';
const CASE_ID = 'case-1';
const LUCIE = 'user-lucie';
const EXPLOITABLE = VerificationExploitabilityEnum.EXPLOITABLE;
const NOT_EXPLOITABLE = VerificationExploitabilityEnum.NOT_EXPLOITABLE;

describe('CompleteCaseVerificationHandler', () => {
  let handler: CompleteCaseVerificationHandler;
  let verifications: InMemoryCaseVerificationRepository;
  let decisions: InMemoryVerificationDecisionRepository;
  let exploitation: InMemoryCaseExploitationReader;
  let cases: InMemoryInvestigationCaseRepository;
  let auditTrail: InMemoryAuditTrailAppender;

  const seedCase = (status: InvestigationCaseStatusEnum): void => {
    cases.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2026-001',
        description: null,
        status,
        operatorUserId: 'user-marie',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-01T10:00:00.000Z'),
      }),
    );
  };

  const seedDecision = (
    traceId: string,
    exploitability = EXPLOITABLE,
    identifiedReferencePrintId: string | null = 'ref-1',
  ) =>
    decisions.seed(
      VerificationDecision.state({
        id: `decision-${traceId}`,
        verificationId: VERIFICATION,
        traceId,
        exploitability,
        identifiedReferencePrintId,
      }),
    );

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    verifications = new InMemoryCaseVerificationRepository(auditTrail);
    decisions = new InMemoryVerificationDecisionRepository(auditTrail);
    exploitation = new InMemoryCaseExploitationReader();
    cases = new InMemoryInvestigationCaseRepository(auditTrail);
    seedCase(InvestigationCaseStatusEnum.IN_PROGRESS);
    verifications.seed(
      CaseVerification.request({
        id: VERIFICATION,
        caseId: CASE_ID,
        verifierUserId: LUCIE,
        requestedByUserId: 'user-marie',
      }),
    );
    exploitation.set(CASE_ID, [
      {
        traceId: 'trace-1',
        status: 'EXPLOITABLE',
        identifiedReferencePrintIds: ['ref-1'],
      },
    ]);
    handler = new CompleteCaseVerificationHandler(
      verifications,
      decisions,
      exploitation,
      new InMemoryTransactionRunner(),
      cases,
    );
  });

  const complete = (requesterId = LUCIE) =>
    handler.execute(
      new CompleteCaseVerificationCommand(
        EXPERT_ACTOR,
        requesterId,
        VERIFICATION,
      ),
    );

  it('clôt la mission en concordance quand tout se recoupe', async () => {
    seedDecision('trace-1');

    await complete();

    const closed = await verifications.findById(VERIFICATION);
    expect(closed?.status).toBe(VerificationStatusEnum.CONCORDANT);
    expect(closed?.completedAt).not.toBeNull();
  });

  it("clôt la mission en discordance dès qu'une seule trace diverge", async () => {
    exploitation.set(CASE_ID, [
      {
        traceId: 'trace-1',
        status: 'EXPLOITABLE',
        identifiedReferencePrintIds: ['ref-1'],
      },
      {
        traceId: 'trace-2',
        status: 'EXPLOITABLE',
        identifiedReferencePrintIds: ['ref-2'],
      },
      {
        traceId: 'trace-3',
        status: 'NOT_EXPLOITABLE',
        identifiedReferencePrintIds: [],
      },
    ]);
    seedDecision('trace-1');
    seedDecision('trace-2', EXPLOITABLE, 'ref-9');
    seedDecision('trace-3', NOT_EXPLOITABLE, null);

    await complete();

    expect((await verifications.findById(VERIFICATION))?.status).toBe(
      VerificationStatusEnum.DISCORDANT,
    );
    const confronted = await decisions.findByVerificationId(VERIFICATION);
    expect(confronted.map((decision) => decision.outcome)).toEqual([
      DecisionOutcomeEnum.CONCORDANT,
      DecisionOutcomeEnum.DISCORDANT,
      DecisionOutcomeEnum.CONCORDANT,
    ]);
  });

  it('fait concorder deux traces inexploitables sans identification', async () => {
    exploitation.set(CASE_ID, [
      {
        traceId: 'trace-1',
        status: 'NOT_EXPLOITABLE',
        identifiedReferencePrintIds: [],
      },
    ]);
    seedDecision('trace-1', NOT_EXPLOITABLE, null);

    await complete();

    expect((await verifications.findById(VERIFICATION))?.status).toBe(
      VerificationStatusEnum.CONCORDANT,
    );
  });

  it('inscrit la clôture au journal, avec le verdict et les traces divergentes', async () => {
    seedDecision('trace-1', EXPLOITABLE, 'ref-9');

    await complete();

    const [act] = auditTrail.events;
    expect(act.eventType).toBe(AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED);
    expect(act.caseId).toBe(CASE_ID);
    expect(act.payload).toEqual({
      verificationId: VERIFICATION,
      verdict: VerificationStatusEnum.DISCORDANT,
      discordantTraceCount: 1,
      discordantTraceIds: ['trace-1'],
    });
  });

  it('refuse de valider tant que des traces restent sans conclusion, et dit combien', async () => {
    exploitation.set(CASE_ID, [
      {
        traceId: 'trace-1',
        status: 'EXPLOITABLE',
        identifiedReferencePrintIds: ['ref-1'],
      },
      {
        traceId: 'trace-2',
        status: 'EXPLOITABLE',
        identifiedReferencePrintIds: [],
      },
      {
        traceId: 'trace-3',
        status: 'EXPLOITABLE',
        identifiedReferencePrintIds: [],
      },
    ]);
    seedDecision('trace-1');

    await expect(complete()).rejects.toBeInstanceOf(
      IncompleteVerificationError,
    );
    await expect(complete()).rejects.toThrow('Il manque 2 conclusion');
    expect((await verifications.findById(VERIFICATION))?.status).toBe(
      VerificationStatusEnum.PENDING,
    );
    expect(auditTrail.events).toHaveLength(0);
  });

  it("refuse la validation à quelqu'un d'autre que le vérificateur", async () => {
    seedDecision('trace-1');

    await expect(complete('user-marie')).rejects.toBeInstanceOf(
      NotTheVerifierError,
    );
    expect((await verifications.findById(VERIFICATION))?.status).toBe(
      VerificationStatusEnum.PENDING,
    );
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse une mission inconnue', async () => {
    await expect(
      handler.execute(
        new CompleteCaseVerificationCommand(EXPERT_ACTOR, LUCIE, 'introuvable'),
      ),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse de valider une vérification sur un dossier clos', async () => {
    seedDecision('trace-1');
    seedCase(InvestigationCaseStatusEnum.CLOSED);

    await expect(complete()).rejects.toBeInstanceOf(CaseClosedError);
    expect((await verifications.findById(VERIFICATION))?.status).toBe(
      VerificationStatusEnum.PENDING,
    );
    expect(auditTrail.events).toHaveLength(0);
  });
});
