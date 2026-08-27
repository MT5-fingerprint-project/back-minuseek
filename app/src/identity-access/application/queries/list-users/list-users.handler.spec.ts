import { ListUsersHandler } from './list-users.handler';
import { ListUsersQuery } from './list-users.query';
import { ServiceUserReadModel } from './service-user-read-model';
import { InMemoryServiceUsersReader } from '../../../infrastructure/persistence/in-memory-service-users.reader';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../../domain/user/value-objects/user-status.vo';

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
    const page = await handler.execute(new ListUsersQuery());

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

    const page = await handler.execute(new ListUsersQuery());

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

    const page = await handler.execute(new ListUsersQuery());

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

    const page = await handler.execute(new ListUsersQuery());

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

    const page = await handler.execute(new ListUsersQuery());

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

    const page = await handler.execute(new ListUsersQuery());

    expect(page.data.map((user) => user.id)).toEqual(['user-1', 'user-2']);
  });

  it('applique la pagination demandée et calcule la meta', async () => {
    for (let index = 1; index <= 5; index++) {
      reader.store.push(
        makeUser({ id: `user-${index}`, lastName: `N${index}` }),
      );
    }

    const page = await handler.execute(new ListUsersQuery(2, 2));

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

    const page = await handler.execute(new ListUsersQuery(4, 20));

    expect(page.data).toEqual([]);
    expect(page.meta.itemCount).toBe(1);
    expect(page.meta.hasNextPage).toBe(false);
    expect(page.meta.hasPreviousPage).toBe(true);
  });
});
