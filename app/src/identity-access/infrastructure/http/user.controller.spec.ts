import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PageDto } from '../../../shared/application/pagination/page.dto';
import { ListUsersQuery } from '../../application/queries/list-users/list-users.query';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { DeactivateUserCommand } from '../../application/commands/deactivate-user/deactivate-user.command';
import { ReactivateUserCommand } from '../../application/commands/reactivate-user/reactivate-user.command';
import { IdentityProviderUnavailableError } from '../../application/ports/identity-provider-unavailable.error';
import { ServiceAccountNotFoundError } from '../../domain/user/errors/service-account-not-found.error';
import {
  SelfStatusChangeNotAllowedError,
  UserAdministrationNotAllowedError,
} from '../../domain/user/errors/user-administration-not-allowed.error';
import { UserRoleEnum } from '../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../domain/user/value-objects/user-status.vo';
import { UserController } from './user.controller';

const CIBLE = '11111111-1111-4111-8111-111111111111';

const MARIE: ServiceUserReadModel = {
  id: 'user-1',
  firstName: 'Marie',
  lastName: 'Curie',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  status: 'ACTIVE',
};

const CHEF: UserReadModel = {
  id: 'user-chef',
  identityProviderId: 'kc-sub-chef',
  role: UserRoleEnum.ADMIN,
  grade: 'Commandant',
  serviceNumber: 'PTS-0001',
  status: 'ACTIVE',
  firstName: 'Nadia',
  lastName: 'Belkacem',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function build(commandFailure?: Error) {
  const dispatchedQueries: ListUsersQuery[] = [];
  const dispatchedCommands: unknown[] = [];
  const queryBus = {
    execute: (query: ListUsersQuery) => {
      dispatchedQueries.push(query);
      return Promise.resolve(
        new PageDto([MARIE], {
          itemCount: 1,
          paginationOptions: {
            page: query.page ?? 1,
            limit: query.limit ?? 20,
          },
        }),
      );
    },
  } as unknown as QueryBus;
  const commandBus = {
    execute: (command: unknown) => {
      if (commandFailure) {
        return Promise.reject(commandFailure);
      }
      dispatchedCommands.push(command);
      return Promise.resolve(undefined);
    },
  } as unknown as CommandBus;
  return {
    controller: new UserController(queryBus, commandBus),
    dispatchedQueries,
    dispatchedCommands,
  };
}

describe('UserController — liste des comptes du service', () => {
  it('rend la page demandée telle que la query la produit', async () => {
    const { controller, dispatchedQueries } = build();

    const page = await controller.list({ page: 2, limit: 5 });

    expect(dispatchedQueries).toEqual([new ListUsersQuery(2, 5)]);
    expect(page.data).toEqual([MARIE]);
    expect(page.meta.page).toBe(2);
    expect(page.meta.limit).toBe(5);
  });

  it('laisse la query poser ses valeurs par défaut quand la requête ne pagine pas', async () => {
    const { controller, dispatchedQueries } = build();

    const page = await controller.list({});

    expect(dispatchedQueries).toEqual([
      new ListUsersQuery(undefined, undefined),
    ]);
    expect(page.meta.page).toBe(1);
    expect(page.meta.limit).toBe(20);
  });
});

describe("UserController — état d'un compte", () => {
  it('dispatche une désactivation, la cible venant du chemin et le demandeur du jeton', async () => {
    const { controller, dispatchedCommands } = build();

    await controller.changeStatus(
      CIBLE,
      { status: UserStatusEnum.DISABLED },
      CHEF,
    );

    expect(dispatchedCommands).toEqual([
      new DeactivateUserCommand(
        { id: 'user-chef', role: UserRoleEnum.ADMIN },
        CIBLE,
      ),
    ]);
  });

  it('dispatche une réactivation', async () => {
    const { controller, dispatchedCommands } = build();

    await controller.changeStatus(
      CIBLE,
      { status: UserStatusEnum.ACTIVE },
      CHEF,
    );

    expect(dispatchedCommands).toEqual([
      new ReactivateUserCommand(
        { id: 'user-chef', role: UserRoleEnum.ADMIN },
        CIBLE,
      ),
    ]);
  });

  it('ne rend aucun corps', async () => {
    const { controller } = build();

    await expect(
      controller.changeStatus(CIBLE, { status: UserStatusEnum.ACTIVE }, CHEF),
    ).resolves.toBeUndefined();
  });

  it("répond 404 quand le jeton n'a pas de compte dans le service", async () => {
    const { controller, dispatchedCommands } = build();

    await expect(
      controller.changeStatus(
        CIBLE,
        { status: UserStatusEnum.DISABLED },
        undefined,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(dispatchedCommands).toEqual([]);
  });

  // Le refus de rôle se décide dans le handler : si le contrôleur figeait le
  // rôle transmis, la garde ne verrait jamais un opérateur.
  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    "transmet le rôle %s de l'appelant tel quel au handler",
    async (role) => {
      const { controller, dispatchedCommands } = build();

      await controller.changeStatus(
        CIBLE,
        { status: UserStatusEnum.DISABLED },
        { ...CHEF, role },
      );

      expect(dispatchedCommands).toEqual([
        new DeactivateUserCommand({ id: 'user-chef', role }, CIBLE),
      ]);
    },
  );

  it.each([
    [new UserAdministrationNotAllowedError(), ForbiddenException],
    [new SelfStatusChangeNotAllowedError(), ForbiddenException],
    [new ServiceAccountNotFoundError(CIBLE), NotFoundException],
    [
      new IdentityProviderUnavailableError('kc-sub-1', new Error('down')),
      BadGatewayException,
    ],
  ])('traduit %s à la frontière HTTP', async (domainError, httpError) => {
    const { controller } = build(domainError);

    await expect(
      controller.changeStatus(CIBLE, { status: UserStatusEnum.DISABLED }, CHEF),
    ).rejects.toThrow(httpError);
  });

  it("laisse remonter une panne qui n'est pas un refus métier", async () => {
    const panne = new Error('base injoignable');
    const { controller } = build(panne);

    const rejected = await controller
      .changeStatus(CIBLE, { status: UserStatusEnum.DISABLED }, CHEF)
      .catch((error: unknown) => error);

    expect(rejected).toBe(panne);
    expect(rejected).not.toBeInstanceOf(HttpException);
  });
});
