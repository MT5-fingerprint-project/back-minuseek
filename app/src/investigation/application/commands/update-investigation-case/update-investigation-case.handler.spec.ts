import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import {
  InvestigationCase,
  NO_JUDICIAL_HEADER,
  NO_RECIPIENT,
} from '../../../domain/investigation-case/entity/investigation-case';
import { CaseClosedError } from '../../../domain/investigation-case/errors/case-closed.error';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';
import { InvalidOffensePeriodError } from '../../../domain/investigation-case/errors/invalid-offense-period.error';
import { DisabledOperatorError } from '../../../domain/investigation-case/errors/disabled-operator.error';
import { OperatorChangeNotAllowedError } from '../../../domain/investigation-case/errors/operator-change-not-allowed.error';
import { UnknownOperatorError } from '../../../domain/investigation-case/errors/unknown-operator.error';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InMemoryInvestigationCaseRepository } from '../../../infrastructure/persistence/in-memory-investigation-case.repository';
import { InMemoryServiceUserDirectory } from '../../../infrastructure/persistence/in-memory-service-user.directory';
import {
  CaseUpdate,
  CaseUpdateRequester,
  UpdateInvestigationCaseCommand,
} from './update-investigation-case.command';
import { UpdateInvestigationCaseHandler } from './update-investigation-case.handler';

const CASE_ID = 'case-1';
const MARIE = 'user-marie';
const PIERRE = 'user-pierre';
const CHEF = 'user-chef';
const PARTI = 'user-parti';
const PV = 'PV-2024-001';

const COMPTES_DU_SERVICE = [
  {
    id: MARIE,
    disabled: false,
    role: UserRoleEnum.OPERATOR,
    firstName: 'Marie',
    lastName: 'Curie',
  },
  {
    id: PIERRE,
    disabled: false,
    role: UserRoleEnum.OPERATOR,
    firstName: 'Pierre',
    lastName: 'Martin',
  },
  {
    id: CHEF,
    disabled: false,
    role: UserRoleEnum.ADMIN,
    firstName: 'Solène',
    lastName: 'Roy',
  },
  {
    id: PARTI,
    disabled: true,
    role: UserRoleEnum.OPERATOR,
    firstName: 'Luc',
    lastName: 'Bonnet',
  },
];

const operator = (id: string) => ({ id, role: UserRoleEnum.OPERATOR });
const serviceManager = (id: string) => ({ id, role: UserRoleEnum.ADMIN });

describe('UpdateInvestigationCaseHandler', () => {
  let handler: UpdateInvestigationCaseHandler;
  let repo: InMemoryInvestigationCaseRepository;
  let directory: InMemoryServiceUserDirectory;
  let auditTrail: InMemoryAuditTrailAppender;

  function seedCase(status = InvestigationCaseStatusEnum.OPEN) {
    repo.store.clear();
    repo.seed(
      InvestigationCase.reconstitute({
        id: CASE_ID,
        caseNumber: 'AFF-001',
        pvNumber: PV,
        description: 'Vol à main armée',
        ...NO_JUDICIAL_HEADER,
        ...NO_RECIPIENT,
        status,
        operatorUserId: MARIE,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:00Z'),
      }),
    );
  }

  const update = (
    changes: CaseUpdate,
    requester: CaseUpdateRequester = operator(MARIE),
    caseId = CASE_ID,
  ) =>
    new UpdateInvestigationCaseCommand(
      EXPERT_ACTOR,
      requester,
      caseId,
      changes,
    );

  const stored = () => repo.store.get(CASE_ID)!;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryInvestigationCaseRepository(auditTrail);
    directory = new InMemoryServiceUserDirectory(COMPTES_DU_SERVICE);
    handler = new UpdateInvestigationCaseHandler(repo, directory);
    seedCase();
  });

  describe('les informations du dossier', () => {
    it('corrige le numéro de procès-verbal sans toucher au reste', async () => {
      await handler.execute(update({ pvNumber: 'PV-2026-118' }));

      expect(stored().pvNumber).toBe('PV-2026-118');
      expect(stored().description).toBe('Vol à main armée');
      expect(stored().operatorUserId).toBe(MARIE);
    });

    it('corrige la description sans toucher au numéro de procès-verbal', async () => {
      await handler.execute(update({ description: 'Vol avec effraction' }));

      expect(stored().description).toBe('Vol avec effraction');
      expect(stored().pvNumber).toBe(PV);
    });

    it('vide une description envoyée à null', async () => {
      await handler.execute(update({ description: null }));

      expect(stored().description).toBeUndefined();
    });

    it("distingue le champ vidé du champ non envoyé : l'acte ne porte que ce qui a été envoyé", async () => {
      await handler.execute(update({ description: null, pvNumber: undefined }));

      expect(auditTrail.events[0].payload).toStrictEqual({
        changes: { description: null },
      });
    });

    it('chaîne un CASE_UPDATED qui porte les champs envoyés et leurs valeurs', async () => {
      await handler.execute(
        update({ pvNumber: 'PV-2026-118', description: 'Vol avec effraction' }),
      );

      expect(auditTrail.events).toHaveLength(1);
      const [event] = auditTrail.events;
      expect(event.eventType).toBe(AuditEventTypeEnum.CASE_UPDATED);
      expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
      expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
      expect(event.caseId).toBe(CASE_ID);
      expect(event.payload).toStrictEqual({
        changes: {
          pvNumber: 'PV-2026-118',
          description: 'Vol avec effraction',
        },
      });
    });

    it("ne touche pas au dépôt quand l'appel ne porte aucun champ", async () => {
      const save = jest.spyOn(repo, 'save');

      await handler.execute(update({}));

      expect(save).not.toHaveBeenCalled();
      expect(auditTrail.events).toHaveLength(0);
      expect(stored().pvNumber).toBe(PV);
    });

    it('garde les corrections successives, sans en perdre une au passage', async () => {
      await handler.execute(update({ pvNumber: 'PV-2026-118' }));
      await handler.execute(update({ description: 'Vol avec effraction' }));

      expect(stored().pvNumber).toBe('PV-2026-118');
      expect(stored().description).toBe('Vol avec effraction');
      expect(auditTrail.events).toHaveLength(2);
    });

    it("laisse un vérificateur corriger le numéro de procès-verbal du dossier qu'il contrôle", async () => {
      await handler.execute(
        update({ pvNumber: 'PV-2026-118' }, operator(PIERRE)),
      );

      expect(stored().pvNumber).toBe('PV-2026-118');
      expect(auditTrail.events).toHaveLength(1);
    });
  });

  describe("l'en-tête judiciaire", () => {
    const JUNE_1ST = new Date('2026-06-01');
    const JUNE_3RD = new Date('2026-06-03');

    const A_FULL_JUDICIAL_HEADER = {
      requestDate: new Date('2026-06-04'),
      requesterQuality: 'Brigadier-Chef de Police',
      requesterName: 'MARCHAND Claire',
      requesterService:
        '3e District de Police Judiciaire de la D.R.P.J de Paris',
      offenseNature: 'Vol par effraction',
      offenseLocation: '12 rue Léon Frot à Paris 11e',
      offenseDateFrom: JUNE_1ST,
      offenseDateTo: JUNE_3RD,
      interventionDate: new Date('2026-06-05'),
      caseAgainst: 'X',
    };

    it('enregistre les dix champs judiciaires', async () => {
      await handler.execute(update(A_FULL_JUDICIAL_HEADER));

      expect(stored().judicialHeader).toEqual(A_FULL_JUDICIAL_HEADER);
    });

    it('chaîne un CASE_UPDATED qui porte les dix champs avec leurs valeurs, dates en ISO-8601', async () => {
      await handler.execute(update(A_FULL_JUDICIAL_HEADER));

      expect(auditTrail.events).toHaveLength(1);
      const [event] = auditTrail.events;
      expect(event.eventType).toBe(AuditEventTypeEnum.CASE_UPDATED);
      expect(event.payload).toStrictEqual({
        changes: {
          ...A_FULL_JUDICIAL_HEADER,
          requestDate: '2026-06-04T00:00:00.000Z',
          offenseDateFrom: '2026-06-01T00:00:00.000Z',
          offenseDateTo: '2026-06-03T00:00:00.000Z',
          interventionDate: '2026-06-05T00:00:00.000Z',
        },
      });
    });

    it('laisse les neuf autres champs intacts quand un seul est renvoyé', async () => {
      await handler.execute(update(A_FULL_JUDICIAL_HEADER));

      await handler.execute(update({ caseAgainst: 'MOREL Bruno' }));

      expect(stored().judicialHeader).toEqual({
        ...A_FULL_JUDICIAL_HEADER,
        caseAgainst: 'MOREL Bruno',
      });
    });

    it('ne perd aucune colonne sur deux modifications de suite', async () => {
      await handler.execute(update({ offenseNature: 'Vol par effraction' }));
      await handler.execute(update({ requesterName: 'MARCHAND Claire' }));

      expect(stored().judicialHeader.offenseNature).toBe('Vol par effraction');
      expect(stored().judicialHeader.requesterName).toBe('MARCHAND Claire');
      expect(stored().pvNumber).toBe(PV);
      expect(stored().description).toBe('Vol à main armée');
    });

    it('vide un champ envoyé à null, et le porte à null dans l’acte', async () => {
      await handler.execute(update({ offenseLocation: 'Paris 11e' }));

      await handler.execute(update({ offenseLocation: null }));

      expect(stored().judicialHeader.offenseLocation).toBeNull();
      expect(auditTrail.events[1].payload).toStrictEqual({
        changes: { offenseLocation: null },
      });
    });

    it('refuse une période inversée sans rien écrire ni chaîner', async () => {
      await expect(
        handler.execute(
          update({
            pvNumber: 'PV-2026-118',
            offenseDateFrom: JUNE_3RD,
            offenseDateTo: JUNE_1ST,
          }),
        ),
      ).rejects.toThrow(InvalidOffensePeriodError);

      expect(auditTrail.events).toHaveLength(0);
      expect(stored().pvNumber).toBe(PV);
      expect(stored().judicialHeader.offenseDateFrom).toBeNull();
    });
  });

  describe("l'opérateur du dossier", () => {
    it("confie le dossier au collègue désigné par l'opérateur en place", async () => {
      await handler.execute(update({ operatorUserId: PIERRE }));

      expect(stored().operatorUserId).toBe(PIERRE);
    });

    it('laisse le responsable de service confier un dossier dont il n’est pas l’opérateur', async () => {
      await handler.execute(
        update({ operatorUserId: PIERRE }, serviceManager(CHEF)),
      );

      expect(stored().operatorUserId).toBe(PIERRE);
    });

    it('accepte de confier le dossier à un responsable de service', async () => {
      await handler.execute(update({ operatorUserId: CHEF }));

      expect(stored().operatorUserId).toBe(CHEF);
    });

    it('chaîne un CASE_OPERATOR_CHANGED qui nomme les deux comptes', async () => {
      await handler.execute(update({ operatorUserId: PIERRE }));

      expect(auditTrail.events).toHaveLength(1);
      const [event] = auditTrail.events;
      expect(event.eventType).toBe(AuditEventTypeEnum.CASE_OPERATOR_CHANGED);
      expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
      expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
      expect(event.caseId).toBe(CASE_ID);
      expect(event.payload).toStrictEqual({
        previousOperatorUserId: MARIE,
        previousOperatorName: 'Marie Curie',
        newOperatorUserId: PIERRE,
        newOperatorName: 'Pierre Martin',
      });
    });

    it("n'invente pas de précédent quand le dossier n'avait pas d'opérateur", async () => {
      repo.store.clear();
      repo.seed(
        InvestigationCase.reconstitute({
          id: CASE_ID,
          caseNumber: 'AFF-001',
          pvNumber: PV,
          description: null,
          ...NO_JUDICIAL_HEADER,
          ...NO_RECIPIENT,
          status: InvestigationCaseStatusEnum.OPEN,
          operatorUserId: null,
          createdAt: new Date('2026-01-01T10:00:00Z'),
          updatedAt: new Date('2026-01-01T10:00:00Z'),
        }),
      );

      await handler.execute(
        update({ operatorUserId: PIERRE }, serviceManager(CHEF)),
      );

      expect(auditTrail.events[0].payload).toStrictEqual({
        previousOperatorUserId: null,
        previousOperatorName: null,
        newOperatorUserId: PIERRE,
        newOperatorName: 'Pierre Martin',
      });
    });

    it("garde l'identifiant du précédent quand l'annuaire ne le connaît plus", async () => {
      repo.store.clear();
      repo.seed(
        InvestigationCase.reconstitute({
          id: CASE_ID,
          caseNumber: 'AFF-001',
          pvNumber: PV,
          description: null,
          ...NO_JUDICIAL_HEADER,
          ...NO_RECIPIENT,
          status: InvestigationCaseStatusEnum.OPEN,
          operatorUserId: 'user-efface',
          createdAt: new Date('2026-01-01T10:00:00Z'),
          updatedAt: new Date('2026-01-01T10:00:00Z'),
        }),
      );

      await handler.execute(
        update({ operatorUserId: PIERRE }, serviceManager(CHEF)),
      );

      expect(auditTrail.events[0].payload).toStrictEqual({
        previousOperatorUserId: 'user-efface',
        previousOperatorName: null,
        newOperatorUserId: PIERRE,
        newOperatorName: 'Pierre Martin',
      });
    });

    it('oppose à un vérificateur le refus d’autorisation avant même de lire l’annuaire', async () => {
      const findById = jest.spyOn(directory, 'findById');

      await expect(
        handler.execute(update({ operatorUserId: PARTI }, operator(PIERRE))),
      ).rejects.toThrow(OperatorChangeNotAllowedError);
      expect(findById).not.toHaveBeenCalled();
    });

    it('distingue un compte désactivé d’un compte inconnu', async () => {
      await expect(
        handler.execute(update({ operatorUserId: PARTI })),
      ).rejects.toThrow(/désactivé/);
    });

    it('ne chaîne aucun acte sur deux refus d’affilée', async () => {
      const refusé = () => handler.execute(update({ operatorUserId: PARTI }));

      await expect(refusé()).rejects.toThrow(DisabledOperatorError);
      await expect(refusé()).rejects.toThrow(DisabledOperatorError);

      expect(auditTrail.events).toHaveLength(0);
    });
  });

  describe("l'appel vaut pour un tout", () => {
    it('inscrit les deux actes du même appel, la correction avant la passation', async () => {
      const save = jest.spyOn(repo, 'save');

      await handler.execute(
        update({ pvNumber: 'PV-2026-118', operatorUserId: PIERRE }),
      );

      expect(save).toHaveBeenCalledTimes(1);
      expect(auditTrail.events.map((event) => event.eventType)).toEqual([
        AuditEventTypeEnum.CASE_UPDATED,
        AuditEventTypeEnum.CASE_OPERATOR_CHANGED,
      ]);
      expect(auditTrail.events[0].payload).toStrictEqual({
        changes: { pvNumber: 'PV-2026-118' },
      });
      expect(stored().pvNumber).toBe('PV-2026-118');
      expect(stored().operatorUserId).toBe(PIERRE);
    });

    it.each([
      [
        'un opérateur qui n’existe pas',
        operator(MARIE),
        'user-fantome',
        UnknownOperatorError,
      ],
      ['un opérateur désactivé', operator(MARIE), PARTI, DisabledOperatorError],
      [
        'un demandeur qui n’a pas le droit de confier',
        operator(PIERRE),
        CHEF,
        OperatorChangeNotAllowedError,
      ],
    ])(
      'refuse en entier l’appel que %s emporte, sans écrire la correction jointe',
      async (_refus, requester, operatorUserId, expectedError) => {
        await expect(
          handler.execute(
            update({ pvNumber: 'PV-2026-118', operatorUserId }, requester),
          ),
        ).rejects.toThrow(expectedError);

        expect(auditTrail.events).toHaveLength(0);
        expect(stored().pvNumber).toBe(PV);
        expect(stored().operatorUserId).toBe(MARIE);
      },
    );

    it.each([
      [
        "une affaire qui n'existe pas",
        InvestigationCaseStatusEnum.OPEN,
        () =>
          update({ pvNumber: 'PV-2026-118' }, operator(MARIE), 'case-fantome'),
        CaseNotFoundError,
      ],
      [
        'une affaire close',
        InvestigationCaseStatusEnum.CLOSED,
        () => update({ pvNumber: 'PV-2026-118' }),
        CaseClosedError,
      ],
      [
        'une affaire close qu’on tente aussi de confier',
        InvestigationCaseStatusEnum.CLOSED,
        () => update({ pvNumber: 'PV-2026-118', operatorUserId: PIERRE }),
        CaseClosedError,
      ],
      [
        'une affaire close qu’on tente seulement de confier',
        InvestigationCaseStatusEnum.CLOSED,
        () => update({ operatorUserId: PIERRE }),
        CaseClosedError,
      ],
      [
        'une affaire close que confie un compte non autorisé — la clôture prime sur l’autorisation',
        InvestigationCaseStatusEnum.CLOSED,
        () => update({ operatorUserId: PIERRE }, operator(PIERRE)),
        CaseClosedError,
      ],
    ])(
      'refuse %s sans chaîner d’acte ni corriger quoi que ce soit',
      async (_refus, status, command, expectedError) => {
        seedCase(status);

        await expect(handler.execute(command())).rejects.toThrow(expectedError);

        expect(auditTrail.events).toHaveLength(0);
        expect(stored().pvNumber).toBe(PV);
        expect(stored().description).toBe('Vol à main armée');
        expect(stored().operatorUserId).toBe(MARIE);
      },
    );
  });
});
