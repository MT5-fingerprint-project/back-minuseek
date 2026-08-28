import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { CaseAlreadyUnderExpertiseError } from '../../../domain/case-expertise/errors/case-already-under-expertise.error';
import { InvalidCaseExpertiseError } from '../../../domain/case-expertise/errors/invalid-case-expertise.error';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { InMemoryCaseExpertiseRepository } from '../../../infrastructure/persistence/in-memory-case-expertise.repository';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { DeclareCaseExpertiseCommand } from './declare-case-expertise.command';
import { DeclareCaseExpertiseHandler } from './declare-case-expertise.handler';

const AFFAIRE = 'affaire-1';
const JULIEN = 'user-julien';
const NADIA = 'user-nadia';
const JURIDICTION = 'Tribunal judiciaire de Paris';
const SERMENT =
  'Je soussigné Julien Marchand, brigadier-chef en fonction au SRPTS de Paris, ' +
  "expert désigné pour procéder aux opérations prévues dans l'ordonnance de " +
  "commission d'expert — exploitation des traces papillaires — de Madame Claire " +
  "Rousseau, juge d'instruction du 4 mars 2026 concernant un véhicule sous scellé " +
  "n° 2026/118, après avoir pris connaissance de la mission qui m'est confiée, " +
  'prête serment de bien et fidèlement la remplir en mon honneur et conscience.';

function build() {
  const auditTrail = new InMemoryAuditTrailAppender();
  const cases = new InMemoryInvestigationCaseRepository(auditTrail);
  const expertises = new InMemoryCaseExpertiseRepository(auditTrail);
  const idGenerator: IdGenerator = {
    generate: jest.fn().mockReturnValue('expertise-1'),
  };
  cases.seed(
    InvestigationCase.open({
      id: AFFAIRE,
      caseNumber: 'AFF-2026-118',
      pvNumber: 'PV-2026-118',
      operatorUserId: JULIEN,
    }),
  );
  return {
    cases,
    expertises,
    auditTrail,
    handler: new DeclareCaseExpertiseHandler(cases, expertises, idGenerator),
  };
}

const commandFor = (
  overrides: {
    requesterUserId?: string;
    caseId?: string;
    oathStatement?: string;
    courtReference?: string;
  } = {},
) =>
  new DeclareCaseExpertiseCommand(
    EXPERT_ACTOR,
    overrides.requesterUserId ?? JULIEN,
    overrides.caseId ?? AFFAIRE,
    overrides.oathStatement ?? SERMENT,
    overrides.courtReference ?? JURIDICTION,
  );

describe('DeclareCaseExpertiseHandler', () => {
  it("archive la déclaration au nom de l'opérateur de l'affaire", async () => {
    const { handler, expertises } = build();

    await handler.execute(commandFor());

    expect(expertises.store.get(AFFAIRE)).toMatchObject({
      id: 'expertise-1',
      caseId: AFFAIRE,
      expertUserId: JULIEN,
      oathStatement: SERMENT,
      courtReference: JURIDICTION,
    });
  });

  it('laisse un acte qui porte le serment mot pour mot', async () => {
    const { handler, expertises, auditTrail } = build();

    await handler.execute(commandFor());

    const swornAt = expertises.store.get(AFFAIRE)?.swornAt;
    expect(auditTrail.events).toHaveLength(1);
    expect(auditTrail.events[0]).toMatchObject({
      eventType: AuditEventTypeEnum.CASE_EXPERTISE_DECLARED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      caseId: AFFAIRE,
      traceId: null,
      payload: {
        courtReference: JURIDICTION,
        swornAt: swornAt?.toISOString(),
        oathStatement: SERMENT,
      },
    });
  });

  it("attribue l'acte à l'auteur de la commande", async () => {
    const { handler, auditTrail } = build();

    await handler.execute(commandFor());

    expect(auditTrail.events[0].actor).toEqual(EXPERT_ACTOR.toPrimitives());
  });

  it("tient pour introuvable une affaire dont l'appelant n'est pas l'opérateur", async () => {
    const { handler, expertises, auditTrail } = build();

    await expect(
      handler.execute(commandFor({ requesterUserId: NADIA })),
    ).rejects.toThrow(CaseNotFoundError);
    expect(expertises.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('tient pour introuvable une affaire qui n’existe pas', async () => {
    const { handler, expertises, auditTrail } = build();

    await expect(
      handler.execute(commandFor({ caseId: 'affaire-inconnue' })),
    ).rejects.toThrow(CaseNotFoundError);
    expect(expertises.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuse une seconde déclaration sur la même affaire', async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor());

    await expect(handler.execute(commandFor())).rejects.toThrow(
      CaseAlreadyUnderExpertiseError,
    );
    expect(auditTrail.events).toHaveLength(1);
  });

  it('refuse une déclaration sans texte de serment', async () => {
    const { handler, expertises, auditTrail } = build();

    await expect(
      handler.execute(commandFor({ oathStatement: '   ' })),
    ).rejects.toThrow(InvalidCaseExpertiseError);
    expect(expertises.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });
});
