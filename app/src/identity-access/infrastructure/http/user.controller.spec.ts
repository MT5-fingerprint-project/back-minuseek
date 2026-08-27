import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PageDto } from '../../../shared/application/pagination/page.dto';
import { ListUserGradesQuery } from '../../application/queries/list-user-grades/list-user-grades.query';
import { ListUsersQuery } from '../../application/queries/list-users/list-users.query';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { CorrectUserProfileCommand } from '../../application/commands/correct-user-profile/correct-user-profile.command';
import { DeactivateUserCommand } from '../../application/commands/deactivate-user/deactivate-user.command';
import { ReactivateUserCommand } from '../../application/commands/reactivate-user/reactivate-user.command';
import { IdentityProviderUnavailableError } from '../../application/ports/identity-provider-unavailable.error';
import { InvalidUserProfileError } from '../../domain/user/errors/invalid-user-profile.error';
import { ServiceAccountNotFoundError } from '../../domain/user/errors/service-account-not-found.error';
import { ServiceNumberAlreadyExistsError } from '../../domain/user/errors/user-already-registered.error';
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

const CORRECTION = {
  firstName: 'Julien',
  lastName: 'Marchand',
  grade: 'Brigadier-chef',
  serviceNumber: 'PTS-0042',
};

function build(commandFailure?: Error) {
  const dispatchedQueries: unknown[] = [];
  const dispatchedCommands: unknown[] = [];
  const queryBus = {
    execute: (query: ListUsersQuery | ListUserGradesQuery) => {
      if (commandFailure) {
        return Promise.reject(commandFailure);
      }
      dispatchedQueries.push(query);
      if (query instanceof ListUserGradesQuery) {
        return Promise.resolve(['Commandant', 'Technicien']);
      }
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

    const page = await controller.list({ page: 2, limit: 5 }, CHEF);

    expect(dispatchedQueries).toEqual([
      new ListUsersQuery(
        2,
        5,
        {},
        { id: 'user-chef', role: UserRoleEnum.ADMIN },
      ),
    ]);
    expect(page.data).toEqual([MARIE]);
    expect(page.meta.page).toBe(2);
    expect(page.meta.limit).toBe(5);
  });

  it('laisse la query poser ses valeurs par défaut quand la requête ne pagine pas', async () => {
    const { controller, dispatchedQueries } = build();

    const page = await controller.list({}, CHEF);

    expect(dispatchedQueries).toEqual([
      new ListUsersQuery(
        undefined,
        undefined,
        {},
        {
          id: 'user-chef',
          role: UserRoleEnum.ADMIN,
        },
      ),
    ]);
    expect(page.meta.page).toBe(1);
    expect(page.meta.limit).toBe(20);
  });
});

describe('UserController — filtres de la liste', () => {
  it('transmet les quatre filtres à la query', async () => {
    const { controller, dispatchedQueries } = build();

    await controller.list(
      {
        page: 1,
        limit: 20,
        search: 'Marchand',
        role: UserRoleEnum.OPERATOR,
        grade: 'Technicien',
        status: UserStatusEnum.DISABLED,
      },
      CHEF,
    );

    expect(dispatchedQueries).toEqual([
      new ListUsersQuery(
        1,
        20,
        {
          search: 'Marchand',
          role: UserRoleEnum.OPERATOR,
          grade: 'Technicien',
          status: UserStatusEnum.DISABLED,
        },
        { id: 'user-chef', role: UserRoleEnum.ADMIN },
      ),
    ]);
  });

  it('transmet un filtre isolé sans inventer les autres', async () => {
    const { controller, dispatchedQueries } = build();

    await controller.list({ search: 'Curie' }, CHEF);

    expect(dispatchedQueries).toEqual([
      new ListUsersQuery(
        undefined,
        undefined,
        { search: 'Curie' },
        {
          id: 'user-chef',
          role: UserRoleEnum.ADMIN,
        },
      ),
    ]);
  });

  it('rend les grades du service', async () => {
    const { controller, dispatchedQueries } = build();

    expect(await controller.listGrades(CHEF)).toEqual([
      'Commandant',
      'Technicien',
    ]);
    expect(dispatchedQueries).toEqual([
      new ListUserGradesQuery({ id: 'user-chef', role: UserRoleEnum.ADMIN }),
    ]);
  });

  // Le refus se décide dans la query ; le contrôleur lui passe le rôle sans le
  // réécrire, et traduit son refus.
  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    "transmet le rôle %s de l'appelant à la query de liste",
    async (role) => {
      const { controller, dispatchedQueries } = build();

      await controller.list({}, { ...CHEF, role });

      expect(dispatchedQueries).toEqual([
        new ListUsersQuery(undefined, undefined, {}, { id: 'user-chef', role }),
      ]);
    },
  );

  it("transmet l'absence de compte de service plutôt que d'inventer un rôle", async () => {
    const { controller, dispatchedQueries } = build();

    await controller.list({}, undefined);

    expect(dispatchedQueries).toEqual([
      new ListUsersQuery(undefined, undefined, {}, null),
    ]);
  });

  it.each([
    ['la liste', (c: UserController) => c.list({}, CHEF)],
    ['les grades', (c: UserController) => c.listGrades(CHEF)],
  ])('traduit en 403 le refus de rôle sur %s', async (_label, call) => {
    const { controller } = build(new UserAdministrationNotAllowedError());

    await expect(call(controller)).rejects.toThrow(ForbiddenException);
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

describe('UserController — correction de profil', () => {
  it('dispatche la correction avec les quatre champs', async () => {
    const { controller, dispatchedCommands } = build();

    await controller.correctProfile(CIBLE, CORRECTION, CHEF);

    expect(dispatchedCommands).toEqual([
      new CorrectUserProfileCommand(
        { id: 'user-chef', role: UserRoleEnum.ADMIN },
        CIBLE,
        CORRECTION,
      ),
    ]);
  });

  it("répond 404 quand le jeton n'a pas de compte dans le service", async () => {
    const { controller, dispatchedCommands } = build();

    await expect(
      controller.correctProfile(CIBLE, CORRECTION, undefined),
    ).rejects.toThrow(NotFoundException);
    expect(dispatchedCommands).toEqual([]);
  });

  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    "transmet le rôle %s de l'appelant tel quel au handler",
    async (role) => {
      const { controller, dispatchedCommands } = build();

      await controller.correctProfile(CIBLE, CORRECTION, { ...CHEF, role });

      expect(dispatchedCommands).toEqual([
        new CorrectUserProfileCommand(
          { id: 'user-chef', role },
          CIBLE,
          CORRECTION,
        ),
      ]);
    },
  );

  it.each([
    [new UserAdministrationNotAllowedError(), ForbiddenException],
    [new ServiceAccountNotFoundError(CIBLE), NotFoundException],
    [new InvalidUserProfileError('grade'), BadRequestException],
    [new ServiceNumberAlreadyExistsError('PTS-0042'), ConflictException],
    [
      new IdentityProviderUnavailableError('kc-sub-1', new Error('down')),
      BadGatewayException,
    ],
  ])('traduit %s à la frontière HTTP', async (domainError, httpError) => {
    const { controller } = build(domainError);

    await expect(
      controller.correctProfile(CIBLE, CORRECTION, CHEF),
    ).rejects.toThrow(httpError);
  });
});
