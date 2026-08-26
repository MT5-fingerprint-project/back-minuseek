import { NotFoundException } from '@nestjs/common';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { OpenInvestigationCaseCommand } from '../../application/commands/open-investigation-case/open-investigation-case.command';
import { InvestigationController } from './investigation.controller';

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
  firstName: 'Marie',
  lastName: 'Curie',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function build() {
  const dispatched: unknown[] = [];
  const commandBus = {
    execute: (command: unknown) => {
      dispatched.push(command);
      return Promise.resolve('case-1');
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
