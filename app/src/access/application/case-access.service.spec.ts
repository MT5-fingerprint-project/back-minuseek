import { UserRoleEnum } from '../../identity-access/domain/user/value-objects/user-role.vo';
import {
  InMemoryCaseAccessReader,
  type CaseAccessFixture,
} from '../infrastructure/persistence/in-memory-case-access.reader';
import { CaseAccessDeniedError } from './case-access-denied.error';
import { CaseAccessService, type CaseRequester } from './case-access.service';

const DOSSIER_DE_MARIE = 'case-marie';
const DOSSIER_DE_LUCIE = 'case-lucie';

const FIXTURE: CaseAccessFixture = {
  operators: [
    { caseId: DOSSIER_DE_MARIE, userId: 'marie' },
    { caseId: DOSSIER_DE_LUCIE, userId: 'lucie' },
  ],
  verifications: [
    { caseId: DOSSIER_DE_MARIE, userId: 'karim', inProgress: true },
    { caseId: DOSSIER_DE_MARIE, userId: 'jules', inProgress: false },
    { caseId: DOSSIER_DE_LUCIE, userId: 'marie', inProgress: true },
  ],
  traces: [{ id: 'trace-1', caseId: DOSSIER_DE_MARIE }],
  referencePrints: [{ id: 'empreinte-1', caseId: DOSSIER_DE_MARIE }],
  layers: [
    { id: 'calque-sur-trace', fingerprintId: 'trace-1' },
    { id: 'calque-sur-empreinte', fingerprintId: 'empreinte-1' },
    { id: 'calque-orphelin', fingerprintId: 'image-inconnue' },
  ],
  subjects: [{ id: 'sujet-1', caseId: DOSSIER_DE_MARIE }],
  reports: [{ id: 'rapport-1', caseId: DOSSIER_DE_MARIE }],
};

const titulaire: CaseRequester = { id: 'marie', role: UserRoleEnum.OPERATOR };
const verificateurEnMission: CaseRequester = {
  id: 'karim',
  role: UserRoleEnum.OPERATOR,
};
const verificateurMissionClose: CaseRequester = {
  id: 'jules',
  role: UserRoleEnum.OPERATOR,
};
const operateurEtranger: CaseRequester = {
  id: 'lucie',
  role: UserRoleEnum.OPERATOR,
};
const expertEtranger: CaseRequester = {
  id: 'sofia',
  role: UserRoleEnum.EXPERT,
};
const expertTitulaire: CaseRequester = {
  id: 'marie',
  role: UserRoleEnum.EXPERT,
};
const responsableDeService: CaseRequester = {
  id: 'nadia',
  role: UserRoleEnum.ADMIN,
};

const service = new CaseAccessService(new InMemoryCaseAccessReader(FIXTURE));

describe("CaseAccessService — l'accès à une affaire", () => {
  it("reconnaît l'opérateur de l'affaire", async () => {
    await expect(
      service.assertAccessToCase(titulaire, DOSSIER_DE_MARIE),
    ).resolves.toBe('CASE_OPERATOR');
  });

  it('reconnaît le vérificateur dont la mission est en cours', async () => {
    await expect(
      service.assertAccessToCase(verificateurEnMission, DOSSIER_DE_MARIE),
    ).resolves.toBe('CASE_VERIFIER');
  });

  it('laisse relire le dossier au vérificateur dont la mission est close', async () => {
    await expect(
      service.assertAccessToCase(verificateurMissionClose, DOSSIER_DE_MARIE),
    ).resolves.toBe('CASE_VERIFIER');
  });

  it("refuse un opérateur étranger à l'affaire", async () => {
    await expect(
      service.assertAccessToCase(operateurEtranger, DOSSIER_DE_MARIE),
    ).rejects.toThrow(CaseAccessDeniedError);
  });

  it('refuse un appelant sans compte dans le service, sans interroger le port', async () => {
    const port = new InMemoryCaseAccessReader(FIXTURE);
    const titres = jest.spyOn(port, 'findTitle');

    await expect(
      new CaseAccessService(port).assertAccessToCase(null, DOSSIER_DE_MARIE),
    ).rejects.toThrow(CaseAccessDeniedError);
    expect(titres).not.toHaveBeenCalled();
  });

  it('refuse une affaire inexistante comme une affaire étrangère', async () => {
    await expect(
      service.assertAccessToCase(titulaire, 'case-qui-nexiste-pas'),
    ).rejects.toThrow(CaseAccessDeniedError);
  });

  it("n'accorde rien de plus à un compte EXPERT qu'à un opérateur", async () => {
    await expect(
      service.assertAccessToCase(expertEtranger, DOSSIER_DE_MARIE),
    ).rejects.toThrow(CaseAccessDeniedError);
    await expect(
      service.assertAccessToCase(expertTitulaire, DOSSIER_DE_MARIE),
    ).resolves.toBe('CASE_OPERATOR');
  });

  it('ouvre toute affaire au responsable de service sans interroger le port', async () => {
    const sansAucuneDonnee = new CaseAccessService(
      new InMemoryCaseAccessReader(),
    );
    await expect(
      sansAucuneDonnee.assertAccessToCase(
        responsableDeService,
        DOSSIER_DE_MARIE,
      ),
    ).resolves.toBe('SERVICE_MANAGER');
  });
});

describe("CaseAccessService — la remontée d'une ressource à son affaire", () => {
  it.each([
    ['TRACE', 'trace-1'],
    ['REFERENCE_PRINT', 'empreinte-1'],
    ['SUBJECT', 'sujet-1'],
    ['REPORT', 'rapport-1'],
  ] as const)('remonte %s à son affaire', async (kind, id) => {
    await expect(
      service.assertAccessTo(titulaire, { kind, id }),
    ).resolves.toEqual({
      caseId: DOSSIER_DE_MARIE,
      title: 'CASE_OPERATOR',
    });
  });

  it.each([
    ["l'image est une trace", 'trace-1'],
    ["l'image est une empreinte de référence", 'empreinte-1'],
  ])('remonte une image à son affaire quand %s', async (_cas, id) => {
    await expect(
      service.assertAccessTo(titulaire, { kind: 'IMAGE', id }),
    ).resolves.toEqual({
      caseId: DOSSIER_DE_MARIE,
      title: 'CASE_OPERATOR',
    });
  });

  it.each([['calque-sur-trace'], ['calque-sur-empreinte']])(
    'remonte le calque %s à son affaire',
    async (id) => {
      await expect(
        service.assertAccessTo(titulaire, { kind: 'LAYER', id }),
      ).resolves.toEqual({
        caseId: DOSSIER_DE_MARIE,
        title: 'CASE_OPERATOR',
      });
    },
  );

  it('refuse une image qui n’est ni une trace ni une empreinte', async () => {
    await expect(
      service.assertAccessTo(titulaire, {
        kind: 'IMAGE',
        id: 'image-inconnue',
      }),
    ).rejects.toThrow(CaseAccessDeniedError);
  });

  it("refuse un calque dont l'image est introuvable", async () => {
    await expect(
      service.assertAccessTo(titulaire, {
        kind: 'LAYER',
        id: 'calque-orphelin',
      }),
    ).rejects.toThrow(CaseAccessDeniedError);
  });

  it.each([
    ['TRACE', 'trace-inconnue'],
    ['LAYER', 'calque-inconnu'],
    ['REPORT', 'rapport-inconnu'],
  ] as const)('refuse %s inexistant sans erreur serveur', async (kind, id) => {
    await expect(
      service.assertAccessTo(titulaire, { kind, id }),
    ).rejects.toThrow(CaseAccessDeniedError);
  });

  it("refuse la trace d'une affaire étrangère", async () => {
    await expect(
      service.assertAccessTo(operateurEtranger, {
        kind: 'TRACE',
        id: 'trace-1',
      }),
    ).rejects.toThrow(CaseAccessDeniedError);
  });
});

describe('CaseAccessService — le filtre de liste', () => {
  it("rend à un opérateur ses affaires et celles qu'il vérifie", async () => {
    await expect(service.visibleCaseIds(titulaire)).resolves.toEqual([
      DOSSIER_DE_MARIE,
      DOSSIER_DE_LUCIE,
    ]);
  });

  it('garde dans la liste du vérificateur le dossier de sa mission close', async () => {
    await expect(
      service.visibleCaseIds(verificateurMissionClose),
    ).resolves.toEqual([DOSSIER_DE_MARIE]);
  });

  it('ne filtre pas la liste du responsable de service', async () => {
    await expect(
      service.visibleCaseIds(responsableDeService),
    ).resolves.toBeNull();
  });
});
