import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { CaseExpertise } from '../../../domain/case-expertise/entity/case-expertise';
import { CaseNotUnderExpertiseError } from '../../../domain/case-expertise/errors/case-not-under-expertise.error';
import { InvalidSaisineError } from '../../../domain/case-expertise/errors/invalid-saisine.error';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { InvestigationCase } from '../../../domain/investigation-case/entity/investigation-case';
import { InMemoryCaseExpertiseRepository } from '../../../infrastructure/persistence/in-memory-case-expertise.repository';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { UpdateCaseSaisineCommand } from './update-case-saisine.command';
import { UpdateCaseSaisineHandler } from './update-case-saisine.handler';

const AFFAIRE = 'affaire-1';
const JULIEN = 'user-julien';
const NADIA = 'user-nadia';
const ORDONNANCE = new Date('2026-03-04T00:00:00.000Z');

function build({ underExpertise = true } = {}) {
  const auditTrail = new InMemoryAuditTrailAppender();
  const cases = new InMemoryInvestigationCaseRepository(auditTrail);
  const expertises = new InMemoryCaseExpertiseRepository(auditTrail);
  cases.seed(
    InvestigationCase.open({
      id: AFFAIRE,
      caseNumber: 'AFF-2026-118',
      pvNumber: 'PV-2026-118',
      operatorUserId: JULIEN,
    }),
  );
  if (underExpertise) {
    expertises.seed(
      CaseExpertise.declare({
        id: 'expertise-1',
        caseId: AFFAIRE,
        expertUserId: JULIEN,
        oathStatement: 'Je soussigné Julien Marchand, prête serment.',
        courtReference: 'Tribunal judiciaire de Paris',
      }),
    );
  }
  return {
    cases,
    expertises,
    auditTrail,
    handler: new UpdateCaseSaisineHandler(cases, expertises),
  };
}

const commandFor = (
  saisine: UpdateCaseSaisineCommand['saisine'],
  requesterUserId = JULIEN,
) =>
  new UpdateCaseSaisineCommand(EXPERT_ACTOR, requesterUserId, AFFAIRE, saisine);

describe('UpdateCaseSaisineHandler', () => {
  it('archive les termes de la commission', async () => {
    const { handler, expertises } = build();

    await handler.execute(
      commandFor({
        magistrateName: 'Claire Rousseau',
        magistrateTitle: "Juge d'instruction",
        ordinanceDate: ORDONNANCE,
        missionObject: 'Exploitation des traces papillaires',
        sealCount: 2,
        biologicalPrecautions: true,
        assistants: [{ name: 'Paul Ferrand', task: 'Ouverture du véhicule' }],
      }),
    );

    expect(expertises.store.get(AFFAIRE)).toMatchObject({
      magistrateName: 'Claire Rousseau',
      ordinanceDate: ORDONNANCE,
      sealCount: 2,
      biologicalPrecautions: true,
      assistants: [{ name: 'Paul Ferrand', task: 'Ouverture du véhicule' }],
    });
  });

  it('laisse un acte qui porte les champs modifiés et leurs valeurs', async () => {
    const { handler, auditTrail } = build();

    await handler.execute(
      commandFor({
        magistrateName: 'Claire Rousseau',
        ordinanceDate: ORDONNANCE,
        assistants: [{ name: 'Paul Ferrand', task: 'Ouverture du véhicule' }],
      }),
    );

    expect(auditTrail.events).toHaveLength(1);
    expect(auditTrail.events[0]).toMatchObject({
      eventType: AuditEventTypeEnum.CASE_SAISINE_UPDATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      caseId: AFFAIRE,
      payload: {
        changes: {
          magistrateName: 'Claire Rousseau',
          ordinanceDate: ORDONNANCE.toISOString(),
          assistants: [{ name: 'Paul Ferrand', task: 'Ouverture du véhicule' }],
        },
      },
    });
  });

  it('ne journalise que le champ corrigé à la seconde mise à jour', async () => {
    const { handler, auditTrail } = build();
    await handler.execute(
      commandFor({ sealCount: 2, missionObject: 'Traces' }),
    );

    await handler.execute(
      commandFor({ sealCount: 2, missionObject: 'Papilles' }),
    );

    expect(auditTrail.events).toHaveLength(2);
    expect(auditTrail.events[1].payload).toEqual({
      changes: { missionObject: 'Papilles' },
    });
  });

  it('ne laisse aucun acte quand la commande ne change rien', async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor({ sealCount: 2 }));

    await handler.execute(commandFor({ sealCount: 2 }));

    expect(auditTrail.events).toHaveLength(1);
  });

  it("tient pour introuvable une affaire dont l'appelant n'est pas l'opérateur", async () => {
    const { handler, auditTrail } = build();

    await expect(
      handler.execute(commandFor({ sealCount: 2 }, NADIA)),
    ).rejects.toThrow(CaseNotFoundError);
    expect(auditTrail.events).toEqual([]);
  });

  it("refuse la saisine d'un dossier qui n'est pas en expertise", async () => {
    const { handler, auditTrail } = build({ underExpertise: false });

    await expect(handler.execute(commandFor({ sealCount: 2 }))).rejects.toThrow(
      CaseNotUnderExpertiseError,
    );
    expect(auditTrail.events).toEqual([]);
  });

  it('ne laisse aucun acte quand le nombre de scellés est négatif', async () => {
    const { handler, auditTrail, expertises } = build();

    await expect(
      handler.execute(commandFor({ sealCount: -1 })),
    ).rejects.toThrow(InvalidSaisineError);
    expect(auditTrail.events).toEqual([]);
    expect(expertises.store.get(AFFAIRE)?.sealCount).toBeNull();
  });

  it("ne laisse aucun acte quand la prorogation précède l'ordonnance", async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor({ ordinanceDate: ORDONNANCE }));

    await expect(
      handler.execute(
        commandFor({
          prorogationOrdinanceDate: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    ).rejects.toThrow(InvalidSaisineError);
    expect(auditTrail.events).toHaveLength(1);
  });
});
