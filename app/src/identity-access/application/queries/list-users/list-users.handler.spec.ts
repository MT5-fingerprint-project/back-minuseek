import { ListUsersHandler } from './list-users.handler';
import { ListUsersQuery } from './list-users.query';
import { ServiceUserReadModel } from './service-user-read-model';
import { InMemoryServiceUsersReader } from '../../../infrastructure/persistence/in-memory-service-users.reader';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../../domain/user/value-objects/user-status.vo';
import { ServiceUsersFilters } from './service-users-filters';

const makeUser = (
  overrides: Partial<ServiceUserReadModel> = {},
): ServiceUserReadModel => ({
  id: 'user-1',
  firstName: 'Marie',
  lastName: 'Curie',
  role: UserRoleEnum.OPERATOR,
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  status: UserStatusEnum.ACTIVE,
  ...overrides,
});

describe('ListUsersHandler', () => {
  let handler: ListUsersHandler;
  let reader: InMemoryServiceUsersReader;

  beforeEach(() => {
    reader = new InMemoryServiceUsersReader();
    handler = new ListUsersHandler(reader);
  });

  it('retourne une page vide quand le service ne compte aucun compte', async () => {
    const page = await handler.execute(
      new ListUsersQuery(undefined, undefined, {}),
    );

    expect(page.data).toEqual([]);
    expect(page.meta).toEqual({
      page: 1,
      limit: 20,
      itemCount: 0,
      pageCount: 0,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it('rend les comptes du service avec leur profil complet', async () => {
    reader.store.push(
      makeUser({
        id: 'user-1',
        firstName: 'Marie',
        lastName: 'Curie',
        role: UserRoleEnum.ADMIN,
        grade: 'Commandant',
        serviceNumber: 'PTS-0001',
      }),
    );

    const page = await handler.execute(
      new ListUsersQuery(undefined, undefined, {}),
    );

    expect(page.data).toEqual([
      {
        id: 'user-1',
        firstName: 'Marie',
        lastName: 'Curie',
        role: UserRoleEnum.ADMIN,
        grade: 'Commandant',
        serviceNumber: 'PTS-0001',
        status: UserStatusEnum.ACTIVE,
      },
    ]);
    expect(page.meta.itemCount).toBe(1);
  });

  it('garde les comptes désactivés dans la liste, avec leur état', async () => {
    reader.store.push(
      makeUser({
        id: 'user-1',
        lastName: 'Curie',
        status: UserStatusEnum.ACTIVE,
      }),
    );
    reader.store.push(
      makeUser({
        id: 'user-2',
        lastName: 'Durand',
        status: UserStatusEnum.DISABLED,
      }),
    );

    const page = await handler.execute(
      new ListUsersQuery(undefined, undefined, {}),
    );

    expect(page.data.map((user) => user.status)).toEqual([
      UserStatusEnum.ACTIVE,
      UserStatusEnum.DISABLED,
    ]);
    expect(page.meta.itemCount).toBe(2);
  });

  it('rend une page entièrement désactivée sans la vider', async () => {
    reader.store.push(
      makeUser({ id: 'user-1', status: UserStatusEnum.DISABLED }),
    );
    reader.store.push(
      makeUser({ id: 'user-2', status: UserStatusEnum.DISABLED }),
    );

    const page = await handler.execute(
      new ListUsersQuery(undefined, undefined, {}),
    );

    expect(page.data).toHaveLength(2);
  });

  it('trie par nom puis prénom', async () => {
    reader.store.push(
      makeUser({ id: 'c', lastName: 'Zola', firstName: 'Ana' }),
    );
    reader.store.push(
      makeUser({ id: 'a', lastName: 'Curie', firstName: 'Pierre' }),
    );
    reader.store.push(
      makeUser({ id: 'b', lastName: 'Curie', firstName: 'Marie' }),
    );

    const page = await handler.execute(
      new ListUsersQuery(undefined, undefined, {}),
    );

    expect(page.data.map((user) => user.id)).toEqual(['b', 'a', 'c']);
  });

  it('départage deux homonymes par identifiant pour que la pagination soit stable', async () => {
    reader.store.push(
      makeUser({
        id: 'user-2',
        lastName: 'Durand',
        firstName: 'Jean',
        status: UserStatusEnum.DISABLED,
      }),
    );
    reader.store.push(
      makeUser({ id: 'user-1', lastName: 'Durand', firstName: 'Jean' }),
    );

    const page = await handler.execute(
      new ListUsersQuery(undefined, undefined, {}),
    );

    expect(page.data.map((user) => user.id)).toEqual(['user-1', 'user-2']);
  });

  it('applique la pagination demandée et calcule la meta', async () => {
    for (let index = 1; index <= 5; index++) {
      reader.store.push(
        makeUser({ id: `user-${index}`, lastName: `N${index}` }),
      );
    }

    const page = await handler.execute(new ListUsersQuery(2, 2, {}));

    expect(page.data.map((user) => user.id)).toEqual(['user-3', 'user-4']);
    expect(page.meta).toEqual({
      page: 2,
      limit: 2,
      itemCount: 5,
      pageCount: 3,
      hasPreviousPage: true,
      hasNextPage: true,
    });
  });

  it('rend une page vide au-delà de la dernière page sans perdre le total', async () => {
    reader.store.push(makeUser({ id: 'user-1' }));

    const page = await handler.execute(new ListUsersQuery(4, 20, {}));

    expect(page.data).toEqual([]);
    expect(page.meta.itemCount).toBe(1);
    expect(page.meta.hasNextPage).toBe(false);
    expect(page.meta.hasPreviousPage).toBe(true);
  });

  describe('filtres', () => {
    beforeEach(() => {
      reader.store.push(
        makeUser({
          id: 'user-1',
          firstName: 'Marie',
          lastName: 'Curie',
          role: UserRoleEnum.ADMIN,
          grade: 'Commandant',
          serviceNumber: 'PTS-0001',
        }),
        makeUser({
          id: 'user-2',
          firstName: 'Julien',
          lastName: 'Marchand',
          role: UserRoleEnum.OPERATOR,
          grade: 'Technicien',
          serviceNumber: 'PTS-0002',
          status: UserStatusEnum.DISABLED,
        }),
        makeUser({
          id: 'user-3',
          firstName: 'Nadia',
          lastName: 'Belkacem',
          role: UserRoleEnum.OPERATOR,
          grade: 'Commandant',
          serviceNumber: 'SN-0003',
        }),
      );
    });

    const idsOf = async (filters: ServiceUsersFilters) =>
      (
        await handler.execute(new ListUsersQuery(undefined, undefined, filters))
      ).data.map((user) => user.id);

    it('rend tout le service quand aucun filtre n’est posé', async () => {
      expect(await idsOf({})).toEqual(['user-3', 'user-1', 'user-2']);
    });

    it('cherche dans le nom', async () => {
      expect(await idsOf({ search: 'Marchand' })).toEqual(['user-2']);
    });

    it('cherche dans le prénom', async () => {
      expect(await idsOf({ search: 'Nadia' })).toEqual(['user-3']);
    });

    it('cherche dans le matricule', async () => {
      expect(await idsOf({ search: 'SN-000' })).toEqual(['user-3']);
    });

    it('ignore la casse', async () => {
      expect(await idsOf({ search: 'mArChAnD' })).toEqual(['user-2']);
    });

    it('cherche un fragment, pas seulement un début de mot', async () => {
      expect(await idsOf({ search: 'chand' })).toEqual(['user-2']);
    });

    it('ne cherche pas dans le grade, qui a son propre filtre', async () => {
      expect(await idsOf({ search: 'Commandant' })).toEqual([]);
    });

    it('traite une recherche vide comme une absence de filtre', async () => {
      expect(await idsOf({ search: '   ' })).toHaveLength(3);
    });

    it('rogne les espaces autour de la recherche', async () => {
      expect(await idsOf({ search: '  Marchand  ' })).toEqual(['user-2']);
    });

    // Le fake cherche un fragment littéral ; l'adapter échappe les jokers de
    // ILIKE pour lui répondre la même chose.
    it.each(['%', '_', 'PTS_0002'])(
      'ne traite pas « %s » comme un joker',
      async (search) => {
        expect(await idsOf({ search })).toEqual([]);
      },
    );

    it('rend une page vide quand rien ne correspond', async () => {
      const page = await handler.execute(
        new ListUsersQuery(undefined, undefined, { search: 'personne' }),
      );

      expect(page.data).toEqual([]);
      expect(page.meta.itemCount).toBe(0);
    });

    it('filtre sur le rôle', async () => {
      expect(await idsOf({ role: UserRoleEnum.OPERATOR })).toEqual([
        'user-3',
        'user-2',
      ]);
    });

    it('filtre sur le grade, à valeur exacte', async () => {
      expect(await idsOf({ grade: 'Commandant' })).toEqual([
        'user-3',
        'user-1',
      ]);
    });

    it('filtre sur l’état', async () => {
      expect(await idsOf({ status: UserStatusEnum.DISABLED })).toEqual([
        'user-2',
      ]);
    });

    it('combine les filtres par ET, jamais par OU', async () => {
      expect(
        await idsOf({ role: UserRoleEnum.OPERATOR, grade: 'Commandant' }),
      ).toEqual(['user-3']);
    });

    it('rend une page vide quand deux filtres s’excluent', async () => {
      expect(
        await idsOf({
          role: UserRoleEnum.ADMIN,
          status: UserStatusEnum.DISABLED,
        }),
      ).toEqual([]);
    });

    it('compte le total sur les lignes filtrées, pas sur tout le service', async () => {
      const page = await handler.execute(
        new ListUsersQuery(1, 1, { role: UserRoleEnum.OPERATOR }),
      );

      expect(page.data.map((user) => user.id)).toEqual(['user-3']);
      expect(page.meta.itemCount).toBe(2);
      expect(page.meta.pageCount).toBe(2);
      expect(page.meta.hasNextPage).toBe(true);
    });

    it('garde le tri et son départage sous filtre', async () => {
      reader.store.push(
        makeUser({
          id: 'user-0',
          firstName: 'Nadia',
          lastName: 'Belkacem',
          role: UserRoleEnum.OPERATOR,
          grade: 'Commandant',
          serviceNumber: 'SN-0004',
        }),
      );

      expect(await idsOf({ grade: 'Commandant' })).toEqual([
        'user-0',
        'user-3',
        'user-1',
      ]);
    });
  });
});
