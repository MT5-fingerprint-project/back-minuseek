import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { ServiceUsersReader } from '../../application/queries/list-users/service-users.reader';

/** Imite l'ordre du lecteur Prisma : nom, prénom, puis identifiant en
 * départage — sans quoi deux homonymes rendraient la pagination instable. */
export class InMemoryServiceUsersReader implements ServiceUsersReader {
  readonly store: ServiceUserReadModel[] = [];

  findAll(pagination: {
    skip: number;
    take: number;
  }): Promise<{ items: ServiceUserReadModel[]; total: number }> {
    const sorted = [...this.store].sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName) ||
        left.firstName.localeCompare(right.firstName) ||
        left.id.localeCompare(right.id),
    );

    return Promise.resolve({
      items: sorted.slice(pagination.skip, pagination.skip + pagination.take),
      total: sorted.length,
    });
  }
}
