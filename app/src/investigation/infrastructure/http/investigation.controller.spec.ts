import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { UpdateInvestigationCaseCommand } from '../../application/commands/update-investigation-case/update-investigation-case.command';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';
import { InvalidOffensePeriodError } from '../../domain/investigation-case/errors/invalid-offense-period.error';
import { CaseClosedError } from '../../domain/investigation-case/errors/case-closed.error';
import { CaseNotFoundError } from '../../domain/investigation-case/errors/case-not-found.error';
import { OperatorChangeNotAllowedError } from '../../domain/investigation-case/errors/operator-change-not-allowed.error';
import { DisabledOperatorError } from '../../domain/investigation-case/errors/disabled-operator.error';
import { UnknownOperatorError } from '../../domain/investigation-case/errors/unknown-operator.error';
import { InvestigationController } from './investigation.controller';

const CASE_ID = '6d7d1c2f-0f4a-4a4e-9f3b-0f1a2b3c4d5e';
const PIERRE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const JETON: AuthenticatedUser = {
  sub: 'kc-sub-42',
  preferred_username: 'mcurie',
  name: 'Marie Curie',
};

const MARIE: UserReadModel = {
  id: 'user-marie',
  identityProviderId: 'kc-sub-42',
  role: UserRoleEnum.OPERATOR,
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  status: 'ACTIVE',
  firstName: 'Marie',
  lastName: 'Curie',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function build(failWith?: Error) {
  const dispatched: unknown[] = [];
  const commandBus = {
    execute: (command: unknown) => {
      dispatched.push(command);
      return failWith ? Promise.reject(failWith) : Promise.resolve('case-1');
    },
  } as unknown as CommandBus;
  const queryBus = { execute: jest.fn() } as unknown as QueryBus;
  return {
    controller: new InvestigationController(commandBus, queryBus),
    dispatched,
  };
}

describe("InvestigationController — ouverture d'une affaire", () => {
  it("confie le dossier au compte de service de l'auteur", async () => {
    const { controller, dispatched } = build();

    await controller.open(
      { caseNumber: 'AFF-001', pvNumber: 'PV-2024-001' },
      JETON,
      MARIE,
    );

    expect(dispatched).toEqual([
      new OpenInvestigationCaseCommand(
        expect.anything() as never,
        MARIE.id,
        'AFF-001',
        'PV-2024-001',
        undefined,
      ),
    ]);
  });

  it("refuse d'ouvrir une affaire depuis un jeton sans compte de service", async () => {
    const { controller, dispatched } = build();

    await expect(
      controller.open(
        { caseNumber: 'AFF-001', pvNumber: 'PV-2024-001' },
        JETON,
        undefined,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(dispatched).toEqual([]);
  });
});

describe('InvestigationController — le destinataire du rapport', () => {
  it('passe les trois lignes à la commande', async () => {
    const { controller, dispatched } = build();

    await controller.updateRecipient(
      CASE_ID,
      {
        authority: 'Le Procureur de la République',
        attentionQuality: 'Brigadier-Chef de Police',
        attentionName: 'MARCHAND Claire',
      },
      JETON,
    );

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toMatchObject({
      caseId: CASE_ID,
      recipient: {
        authority: 'Le Procureur de la République',
        attentionQuality: 'Brigadier-Chef de Police',
        attentionName: 'MARCHAND Claire',
      },
    });
  });

  it('laisse partir une ligne absente, que le domaine efface', async () => {
    const { controller, dispatched } = build();

    await controller.updateRecipient(
      CASE_ID,
      { authority: 'Le Procureur de la République' },
      JETON,
    );

    expect(dispatched[0]).toMatchObject({
      recipient: {
        authority: 'Le Procureur de la République',
        attentionQuality: undefined,
        attentionName: undefined,
      },
    });
  });

  it.each([
    [new CaseNotFoundError(CASE_ID), NotFoundException],
    [new CaseClosedError(CASE_ID), ConflictException],
  ])('traduit %s à la frontière HTTP', async (domainError, httpError) => {
    const { controller } = build(domainError);

    await expect(
      controller.updateRecipient(
        CASE_ID,
        { authority: 'Le Procureur de la République' },
        JETON,
      ),
    ).rejects.toThrow(httpError);
  });
});

describe("InvestigationController — modification d'une affaire", () => {
  it("passe le compte de l'appelant, son rôle et les seuls champs envoyés", async () => {
    const { controller, dispatched } = build();

    await controller.update(
      CASE_ID,
      { pvNumber: 'PV-2026-118', operatorUserId: PIERRE_ID },
      JETON,
      MARIE,
    );

    expect(dispatched).toStrictEqual([
      new UpdateInvestigationCaseCommand(
        expect.anything() as never,
        { id: MARIE.id, role: UserRoleEnum.OPERATOR },
        CASE_ID,
        {
          pvNumber: 'PV-2026-118',
          description: undefined,
          operatorUserId: PIERRE_ID,
        },
      ),
    ]);
  });

  it.each([
    ['une description corrigée', 'Vol avec effraction'],
    ['une description vidée', null],
  ])('transmet %s telle quelle à la commande', async (_cas, description) => {
    const { controller, dispatched } = build();

    await controller.update(CASE_ID, { description }, JETON, MARIE);

    expect(dispatched).toStrictEqual([
      new UpdateInvestigationCaseCommand(
        expect.anything() as never,
        { id: MARIE.id, role: UserRoleEnum.OPERATOR },
        CASE_ID,
        { pvNumber: undefined, description, operatorUserId: undefined },
      ),
    ]);
  });

  it('refuse un jeton sans compte de service, sans rien dispatcher', async () => {
    const { controller, dispatched } = build();

    await expect(
      controller.update(CASE_ID, { pvNumber: 'PV-2026-118' }, JETON, undefined),
    ).rejects.toThrow(NotFoundException);
    expect(dispatched).toEqual([]);
  });

  it.each([
    [new CaseNotFoundError(CASE_ID), NotFoundException],
    [new OperatorChangeNotAllowedError(CASE_ID), ForbiddenException],
    [new UnknownOperatorError(PIERRE_ID), BadRequestException],
    [new DisabledOperatorError(PIERRE_ID), BadRequestException],
    [new CaseClosedError(CASE_ID), ConflictException],
    [new InvalidOffensePeriodError(), BadRequestException],
  ])('traduit %s à la frontière HTTP', async (domainError, httpError) => {
    const { controller } = build(domainError);

    await expect(
      controller.update(CASE_ID, { operatorUserId: PIERRE_ID }, JETON, MARIE),
    ).rejects.toThrow(httpError);
  });

  it("laisse remonter une panne qui n'est pas un refus métier", async () => {
    const { controller } = build(new Error('base injoignable'));

    await expect(
      controller.update(CASE_ID, { pvNumber: 'PV-2026-118' }, JETON, MARIE),
    ).rejects.toThrow('base injoignable');
  });

  it('convertit les quatre dates judiciaires et passe les six textes tels quels', async () => {
    const { controller, dispatched } = build();

    await controller.update(
      CASE_ID,
      {
        requestDate: '2026-06-04',
        requesterQuality: 'Brigadier-Chef de Police',
        requesterName: 'MARCHAND Claire',
        requesterService:
          '3e District de Police Judiciaire de la D.R.P.J de Paris',
        offenseNature: 'Vol par effraction',
        offenseLocation: '12 rue Léon Frot à Paris 11e',
        offenseDateFrom: '2026-06-01',
        offenseDateTo: '2026-06-03',
        interventionDate: '2026-06-05',
        caseAgainst: 'X',
      },
      JETON,
      MARIE,
    );

    expect(dispatched[0]).toMatchObject({
      changes: {
        requestDate: new Date('2026-06-04'),
        requesterQuality: 'Brigadier-Chef de Police',
        requesterName: 'MARCHAND Claire',
        requesterService:
          '3e District de Police Judiciaire de la D.R.P.J de Paris',
        offenseNature: 'Vol par effraction',
        offenseLocation: '12 rue Léon Frot à Paris 11e',
        offenseDateFrom: new Date('2026-06-01'),
        offenseDateTo: new Date('2026-06-03'),
        interventionDate: new Date('2026-06-05'),
        caseAgainst: 'X',
      },
    });
  });

  it('passe une date judiciaire vidée à null, sans la transformer en époque', async () => {
    const { controller, dispatched } = build();

    await controller.update(CASE_ID, { offenseDateTo: null }, JETON, MARIE);

    expect(dispatched[0]).toMatchObject({ changes: { offenseDateTo: null } });
  });

  it("n'inscrit dans la commande aucun champ judiciaire absent du corps", async () => {
    const { controller, dispatched } = build();

    await controller.update(
      CASE_ID,
      { offenseNature: 'Vol par effraction' },
      JETON,
      MARIE,
    );

    const { changes } = dispatched[0] as UpdateInvestigationCaseCommand;
    expect(Object.keys(changes).sort()).toEqual([
      'description',
      'offenseNature',
      'operatorUserId',
      'pvNumber',
    ]);
  });
});
