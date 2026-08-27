import { InMemoryServiceUserGradesReader } from '../../../infrastructure/persistence/in-memory-service-user-grades.reader';
import { UserAdministrationNotAllowedError } from '../../../domain/user/errors/user-administration-not-allowed.error';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import { ListUserGradesQuery } from './list-user-grades.query';
import { ListUserGradesHandler } from './list-user-grades.handler';

const CHEF = { id: 'user-chef', role: UserRoleEnum.ADMIN };

describe('ListUserGradesHandler', () => {
  let reader: InMemoryServiceUserGradesReader;
  let handler: ListUserGradesHandler;

  beforeEach(() => {
    reader = new InMemoryServiceUserGradesReader();
    handler = new ListUserGradesHandler(reader);
  });

  it('rend les grades du service, dédoublonnés et triés', async () => {
    reader.store.push('Technicien', 'Commandant', 'Technicien');

    expect(await handler.execute(new ListUserGradesQuery(CHEF))).toEqual([
      'Commandant',
      'Technicien',
    ]);
  });

  it('rend une liste vide quand le service ne compte aucun compte', async () => {
    expect(await handler.execute(new ListUserGradesQuery(CHEF))).toEqual([]);
  });

  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    'refuse un appelant %s',
    async (role) => {
      reader.store.push('Brigadier');

      await expect(
        handler.execute(new ListUserGradesQuery({ id: 'x', role })),
      ).rejects.toThrow(UserAdministrationNotAllowedError);
    },
  );

  it('refuse un jeton sans compte de service', async () => {
    await expect(
      handler.execute(new ListUserGradesQuery(null)),
    ).rejects.toThrow(UserAdministrationNotAllowedError);
  });
});
