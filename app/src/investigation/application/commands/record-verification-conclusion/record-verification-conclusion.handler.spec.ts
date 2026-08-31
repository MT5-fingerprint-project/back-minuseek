import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { CaseVerification } from '../../../domain/case-verification/entity/case-verification';
import { NotTheVerifierError } from '../../../domain/case-verification/errors/not-the-verifier.error';
import { TraceOutsideVerificationError } from '../../../domain/case-verification/errors/trace-outside-verification.error';
import { VerificationNotFoundError } from '../../../domain/case-verification/errors/verification-not-found.error';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import { DecisionOutcomeEnum } from '../../../domain/case-verification/value-objects/decision-outcome.vo';
import { VerificationExploitabilityEnum } from '../../../domain/case-verification/value-objects/verification-exploitability.vo';
import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';
import {
  InvestigationCase,
  NO_JUDICIAL_HEADER,
} from '../../../domain/investigation-case/entity/investigation-case';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryCaseExploitationReader } from '../../../infrastructure/persistence/in-memory-case-exploitation.reader';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InMemoryCaseVerificationRepository } from '../../../infrastructure/persistence/in-memory-case-verification.repository';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { InMemoryVerificationDecisionRepository } from '../../../infrastructure/persistence/in-memory-verification-decision.repository';
import { RecordVerificationConclusionCommand } from './record-verification-conclusion.command';
import { RecordVerificationConclusionHandler } from './record-verification-conclusion.handler';

const VERIFICATION = 'verification-1';
const CASE_ID = 'case-1';
const LUCIE = 'user-lucie';
const EXPLOITABLE = VerificationExploitabilityEnum.EXPLOITABLE;
const NOT_EXPLOITABLE = VerificationExploitabilityEnum.NOT_EXPLOITABLE;

describe('RecordVerificationConclusionHandler', () => {
  let handler: RecordVerificationConclusionHandler;
  let verifications: InMemoryCaseVerificationRepository;
  let decisions: InMemoryVerificationDecisionRepository;
  let exploitation: InMemoryCaseExploitationReader;
  let cases: InMemoryInvestigationCaseRepository;
  let auditTrail: InMemoryAuditTrailAppender;
  let nextId: number;

  const seedCase = (status: InvestigationCaseStatusEnum): void => {
    cases.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2026-001',
        description: null,
        ...NO_JUDICIAL_HEADER,
        ...NO_JUDICIAL_HEADER,
        status,
        operatorUserId: 'user-marie',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-01T10:00:00.000Z'),
      }),
    );
  };

  beforeEach(() => {
    nextId = 0;
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
    handler = new RecordVerificationConclusionHandler(
      verifications,
      decisions,
      exploitation,
      new InMemoryTransactionRunner(),
      cases,
      { generate: () => `decision-${++nextId}` },
    );
  });

  const conclude = (
    exploitability = EXPLOITABLE,
    identifiedReferencePrintId: string | null = 'ref-1',
    requesterId = LUCIE,
    traceId = 'trace-1',
  ) =>
    handler.execute(
      new RecordVerificationConclusionCommand(
        EXPERT_ACTOR,
        requesterId,
        VERIFICATION,
        traceId,
        exploitability,
        identifiedReferencePrintId,
      ),
    );

  it('enregistre la conclusion du vérificateur sur une trace', async () => {
    await conclude();

    const [decision] = await decisions.findByVerificationId(VERIFICATION);
    expect(decision.traceId).toBe('trace-1');
    expect(decision.exploitability).toBe(EXPLOITABLE);
    expect(decision.identifiedReferencePrintId).toBe('ref-1');
    expect(decision.outcome).toBeNull();
  });

  it('inscrit la conclusion au journal, avec ses valeurs', async () => {
    await conclude();

    expect(auditTrail.events).toHaveLength(1);
    const [act] = auditTrail.events;
    expect(act.eventType).toBe(
      AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED,
    );
    expect(act.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(act.caseId).toBe(CASE_ID);
    expect(act.traceId).toBe('trace-1');
    expect(act.payload).toEqual({
      verificationId: VERIFICATION,
      traceId: 'trace-1',
      exploitability: EXPLOITABLE,
      identifiedReferencePrintId: 'ref-1',
    });
  });

  it('remplace la conclusion précédente sur la même trace, sans en créer une seconde', async () => {
    await conclude();

    await conclude(NOT_EXPLOITABLE, null);

    const stated = await decisions.findByVerificationId(VERIFICATION);
    expect(stated).toHaveLength(1);
    expect(stated[0].exploitability).toBe(NOT_EXPLOITABLE);
    expect(stated[0].identifiedReferencePrintId).toBeNull();
    expect(auditTrail.events).toHaveLength(2);
  });

  it("refuse la conclusion de quelqu'un d'autre que le vérificateur", async () => {
    await expect(
      conclude(EXPLOITABLE, 'ref-1', 'user-marie'),
    ).rejects.toBeInstanceOf(NotTheVerifierError);
    expect(await decisions.findByVerificationId(VERIFICATION)).toEqual([]);
    expect(auditTrail.events).toHaveLength(0);
  });

  it("refuse une conclusion sur une trace qui n'est pas au dossier", async () => {
    await expect(
      conclude(EXPLOITABLE, null, LUCIE, 'trace-etrangere'),
    ).rejects.toBeInstanceOf(TraceOutsideVerificationError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse une mission inconnue', async () => {
    await expect(
      handler.execute(
        new RecordVerificationConclusionCommand(
          EXPERT_ACTOR,
          LUCIE,
          'introuvable',
          'trace-1',
          EXPLOITABLE,
          null,
        ),
      ),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('laisse le vérificateur revenir sur sa conclusion après la validation', async () => {
    const closed = await verifications.findById(VERIFICATION);
    closed!.complete(DecisionOutcomeEnum.CONCORDANT);
    await verifications.save(closed!);

    await conclude(EXPLOITABLE, 'ref-9');

    expect((await verifications.findById(VERIFICATION))?.status).toBe(
      VerificationStatusEnum.DISCORDANT,
    );
  });

  it('inscrit le nouveau verdict au journal, sans effacer le premier', async () => {
    const closed = await verifications.findById(VERIFICATION);
    closed!.complete(DecisionOutcomeEnum.CONCORDANT);
    await verifications.save(closed!);

    await conclude(EXPLOITABLE, 'ref-9');

    const types = auditTrail.events.map((event) => event.eventType);
    expect(types).toEqual([
      AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED,
      AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED,
    ]);
    expect(auditTrail.events[1].payload).toMatchObject({
      verdict: VerificationStatusEnum.DISCORDANT,
      discordantTraceIds: ['trace-1'],
    });
  });

  it('ne rejoue pas la confrontation tant que la mission est en cours', async () => {
    await conclude(EXPLOITABLE, 'ref-9');

    expect((await verifications.findById(VERIFICATION))?.status).toBe(
      VerificationStatusEnum.PENDING,
    );
    expect(auditTrail.events).toHaveLength(1);
  });

  it('refuse une conclusion sur un dossier clos, et ne journalise rien', async () => {
    seedCase(InvestigationCaseStatusEnum.CLOSED);

    await expect(conclude()).rejects.toBeInstanceOf(CaseClosedError);
    expect(await decisions.findByVerificationId(VERIFICATION)).toEqual([]);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse la révision une fois le dossier clos', async () => {
    await conclude();
    seedCase(InvestigationCaseStatusEnum.CLOSED);

    await expect(conclude(NOT_EXPLOITABLE, null)).rejects.toBeInstanceOf(
      CaseClosedError,
    );
    const stated = await decisions.findByVerificationId(VERIFICATION);
    expect(stated[0].exploitability).toBe(EXPLOITABLE);
  });
});
