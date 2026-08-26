import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { PageDto } from '../../../shared/application/pagination/page.dto';
import { ListUsersQuery } from '../../application/queries/list-users/list-users.query';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { UserController } from './user.controller';

const MARIE: ServiceUserReadModel = {
  id: 'user-1',
  firstName: 'Marie',
  lastName: 'Curie',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
};

function build() {
  const dispatched: ListUsersQuery[] = [];
  const queryBus = {
    execute: (query: ListUsersQuery) => {
      dispatched.push(query);
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
  const commandBus = { execute: jest.fn() } as unknown as CommandBus;
  return { controller: new UserController(commandBus, queryBus), dispatched };
}

describe('UserController — liste des comptes du service', () => {
  it('rend la page demandée telle que la query la produit', async () => {
    const { controller, dispatched } = build();

    const page = await controller.list({ page: 2, limit: 5 });

    expect(dispatched).toEqual([new ListUsersQuery(2, 5)]);
    expect(page.data).toEqual([MARIE]);
    expect(page.meta.page).toBe(2);
    expect(page.meta.limit).toBe(5);
  });

  it('laisse la query poser ses valeurs par défaut quand la requête ne pagine pas', async () => {
    const { controller, dispatched } = build();

    const page = await controller.list({});

    expect(dispatched).toEqual([new ListUsersQuery(undefined, undefined)]);
    expect(page.meta.page).toBe(1);
    expect(page.meta.limit).toBe(20);
  });
});
