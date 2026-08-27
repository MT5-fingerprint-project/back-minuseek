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
import { ChangeCaseOperatorCommand } from '../../application/commands/change-case-operator/change-case-operator.command';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';
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

describe("InvestigationController — changement d'opérateur", () => {
  it("passe le compte de l'appelant et son rôle à la commande", async () => {
    const { controller, dispatched } = build();

    await controller.changeOperator(
      CASE_ID,
      { operatorUserId: PIERRE_ID },
      JETON,
      MARIE,
    );

    expect(dispatched).toEqual([
      new ChangeCaseOperatorCommand(
        expect.anything() as never,
        { id: MARIE.id, role: UserRoleEnum.OPERATOR },
        CASE_ID,
        PIERRE_ID,
      ),
    ]);
  });

  it('refuse un jeton sans compte de service, sans rien dispatcher', async () => {
    const { controller, dispatched } = build();

    await expect(
      controller.changeOperator(
        CASE_ID,
        { operatorUserId: PIERRE_ID },
        JETON,
        undefined,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(dispatched).toEqual([]);
  });

  it.each([
    [new CaseNotFoundError(CASE_ID), NotFoundException],
    [new OperatorChangeNotAllowedError(CASE_ID), ForbiddenException],
    [new UnknownOperatorError(PIERRE_ID), BadRequestException],
    [new DisabledOperatorError(PIERRE_ID), BadRequestException],
    [new CaseClosedError(CASE_ID), ConflictException],
  ])('traduit %s à la frontière HTTP', async (domainError, httpError) => {
    const { controller } = build(domainError);

    await expect(
      controller.changeOperator(
        CASE_ID,
        { operatorUserId: PIERRE_ID },
        JETON,
        MARIE,
      ),
    ).rejects.toThrow(httpError);
  });

  it("laisse remonter une panne qui n'est pas un refus métier", async () => {
    const { controller } = build(new Error('base injoignable'));

    await expect(
      controller.changeOperator(
        CASE_ID,
        { operatorUserId: PIERRE_ID },
        JETON,
        MARIE,
      ),
    ).rejects.toThrow('base injoignable');
  });
});
