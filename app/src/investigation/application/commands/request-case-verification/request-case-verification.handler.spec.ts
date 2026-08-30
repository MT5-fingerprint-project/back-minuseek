import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { CaseVerification } from '../../../domain/case-verification/entity/case-verification';
import { CaseVerificationNotAllowedError } from '../../../domain/case-verification/errors/case-verification-not-allowed.error';
import { SelfVerificationError } from '../../../domain/case-verification/errors/self-verification.error';
import { VerificationAlreadyPendingError } from '../../../domain/case-verification/errors/verification-already-pending.error';
import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { DisabledOperatorError } from '../../../domain/investigation-case/errors/disabled-operator.error';
import { UnknownOperatorError } from '../../../domain/investigation-case/errors/unknown-operator.error';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryCaseVerificationRepository } from '../../../infrastructure/persistence/in-memory-case-verification.repository';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InMemoryServiceUserDirectory } from '../../../infrastructure/persistence/in-memory-service-user.directory';
import { RequestCaseVerificationCommand } from './request-case-verification.command';
import { RequestCaseVerificationHandler } from './request-case-verification.handler';

const CASE_ID = 'case-1';
const MARIE = 'user-marie';
const LUCIE = 'user-lucie';
const CHEF = 'user-chef';

const titulaire = { id: MARIE, role: UserRoleEnum.OPERATOR };
const responsable = { id: CHEF, role: UserRoleEnum.ADMIN };
const verificateur = { id: LUCIE, role: UserRoleEnum.OPERATOR };

describe('RequestCaseVerificationHandler', () => {
  let handler: RequestCaseVerificationHandler;
  let cases: InMemoryInvestigationCaseRepository;
  let verifications: InMemoryCaseVerificationRepository;
  let auditTrail: InMemoryAuditTrailAppender;

  const seedCase = (status: InvestigationCaseStatusEnum): void => {
    cases.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: 'PV-2026-001',
        description: null,
        status,
        operatorUserId: MARIE,
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        updatedAt: new Date('2026-08-01T10:00:00.000Z'),
      }),
    );
  };

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    cases = new InMemoryInvestigationCaseRepository(auditTrail);
    verifications = new InMemoryCaseVerificationRepository(auditTrail);
    handler = new RequestCaseVerificationHandler(
      cases,
      verifications,
      new InMemoryServiceUserDirectory([
        {
          id: LUCIE,
          disabled: false,
          firstName: 'Lucie',
          lastName: 'Bernard',
        },
        {
          id: 'user-parti',
          disabled: true,
          firstName: 'Paul',
          lastName: 'Renaud',
        },
      ]),
      { generate: () => 'verification-1' },
    );
    seedCase(InvestigationCaseStatusEnum.IN_PROGRESS);
  });

  it("confie une vérification en cours, sans toucher à l'opérateur de l'affaire", async () => {
    const id = await handler.execute(
      new RequestCaseVerificationCommand(
        EXPERT_ACTOR,
        titulaire,
        CASE_ID,
        LUCIE,
      ),
    );

    expect(id).toBe('verification-1');
    const created = verifications.store.get('verification-1');
    expect(created?.caseId).toBe(CASE_ID);
    expect(created?.verifierUserId).toBe(LUCIE);
    expect(created?.requestedByUserId).toBe(MARIE);
    expect(created?.status).toBe(VerificationStatusEnum.PENDING);
    expect((await cases.findById(CASE_ID))?.operatorUserId).toBe(MARIE);
  });

  it('inscrit au journal qui a confié la vérification, et à qui', async () => {
    await handler.execute(
      new RequestCaseVerificationCommand(
        EXPERT_ACTOR,
        titulaire,
        CASE_ID,
        LUCIE,
      ),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [act] = auditTrail.events;
    expect(act.eventType).toBe(AuditEventTypeEnum.CASE_VERIFICATION_REQUESTED);
    expect(act.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(act.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(act.caseId).toBe(CASE_ID);
    expect(act.payload).toEqual({
      verificationId: 'verification-1',
      verifierUserId: LUCIE,
      verifierName: 'Lucie Bernard',
      requestedByUserId: MARIE,
    });
  });

  it("laisse le responsable de service confier une affaire qui n'est pas la sienne", async () => {
    await handler.execute(
      new RequestCaseVerificationCommand(
        EXPERT_ACTOR,
        responsable,
        CASE_ID,
        LUCIE,
      ),
    );

    expect(verifications.store.get('verification-1')?.requestedByUserId).toBe(
      CHEF,
    );
  });

  it("accepte une deuxième mission en cours sur la même affaire, confiée à quelqu'un d'autre", async () => {
    verifications.seed(
      CaseVerification.request({
        id: 'verification-0',
        caseId: CASE_ID,
        verifierUserId: 'user-autre',
        requestedByUserId: MARIE,
      }),
    );

    await handler.execute(
      new RequestCaseVerificationCommand(
        EXPERT_ACTOR,
        titulaire,
        CASE_ID,
        LUCIE,
      ),
    );

    expect(verifications.store.size).toBe(2);
  });

  it('refuse de confier une affaire inconnue', async () => {
    await expect(
      handler.execute(
        new RequestCaseVerificationCommand(
          EXPERT_ACTOR,
          titulaire,
          'introuvable',
          LUCIE,
        ),
      ),
    ).rejects.toBeInstanceOf(CaseNotFoundError);
    expect(verifications.store.size).toBe(0);
    expect(auditTrail.events).toHaveLength(0);
  });

  it("refuse le vérificateur désigné par quelqu'un qui n'est ni titulaire ni responsable", async () => {
    await expect(
      handler.execute(
        new RequestCaseVerificationCommand(
          EXPERT_ACTOR,
          verificateur,
          CASE_ID,
          'user-autre',
        ),
      ),
    ).rejects.toBeInstanceOf(CaseVerificationNotAllowedError);
    expect(verifications.store.size).toBe(0);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse de confier une affaire close', async () => {
    seedCase(InvestigationCaseStatusEnum.CLOSED);

    await expect(
      handler.execute(
        new RequestCaseVerificationCommand(
          EXPERT_ACTOR,
          titulaire,
          CASE_ID,
          LUCIE,
        ),
      ),
    ).rejects.toBeInstanceOf(CaseClosedError);
    expect(verifications.store.size).toBe(0);
  });

  it("refuse de confier la vérification à l'opérateur de l'affaire", async () => {
    await expect(
      handler.execute(
        new RequestCaseVerificationCommand(
          EXPERT_ACTOR,
          titulaire,
          CASE_ID,
          MARIE,
        ),
      ),
    ).rejects.toBeInstanceOf(SelfVerificationError);
    expect(verifications.store.size).toBe(0);
    expect(auditTrail.events).toHaveLength(0);
  });

  it("refuse un compte qui n'existe pas dans le service", async () => {
    await expect(
      handler.execute(
        new RequestCaseVerificationCommand(
          EXPERT_ACTOR,
          titulaire,
          CASE_ID,
          'user-fantome',
        ),
      ),
    ).rejects.toBeInstanceOf(UnknownOperatorError);
    expect(verifications.store.size).toBe(0);
  });

  it('refuse un compte désactivé', async () => {
    await expect(
      handler.execute(
        new RequestCaseVerificationCommand(
          EXPERT_ACTOR,
          titulaire,
          CASE_ID,
          'user-parti',
        ),
      ),
    ).rejects.toBeInstanceOf(DisabledOperatorError);
    expect(verifications.store.size).toBe(0);
  });

  it('refuse une deuxième mission en cours à la même personne sur la même affaire', async () => {
    verifications.seed(
      CaseVerification.request({
        id: 'verification-0',
        caseId: CASE_ID,
        verifierUserId: LUCIE,
        requestedByUserId: MARIE,
      }),
    );

    await expect(
      handler.execute(
        new RequestCaseVerificationCommand(
          EXPERT_ACTOR,
          titulaire,
          CASE_ID,
          LUCIE,
        ),
      ),
    ).rejects.toBeInstanceOf(VerificationAlreadyPendingError);
    expect(verifications.store.size).toBe(1);
  });

  it('laisse reconfier une affaire à la même personne une fois sa mission close', async () => {
    verifications.seed(
      CaseVerification.reconstitute({
        id: 'verification-0',
        caseId: CASE_ID,
        verifierUserId: LUCIE,
        requestedByUserId: MARIE,
        status: VerificationStatusEnum.CONCORDANT,
        requestedAt: new Date('2026-08-02T10:00:00.000Z'),
        completedAt: new Date('2026-08-03T10:00:00.000Z'),
      }),
    );

    await handler.execute(
      new RequestCaseVerificationCommand(
        EXPERT_ACTOR,
        titulaire,
        CASE_ID,
        LUCIE,
      ),
    );

    expect(verifications.store.size).toBe(2);
  });
});
