import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { ServiceUsersFilters } from '../../application/queries/list-users/service-users-filters';
import { ServiceUsersReader } from '../../application/queries/list-users/service-users.reader';

/** Imite le lecteur Prisma : mêmes filtres, même ordre — nom, prénom, puis
 * identifiant en départage, sans quoi deux homonymes rendraient la pagination
 * instable. La recherche est insensible à la casse et sensible aux accents,
 * comme le `ILIKE` que produit `mode: 'insensitive'`. */
export class InMemoryServiceUsersReader implements ServiceUsersReader {
  readonly store: ServiceUserReadModel[] = [];

  findAll(
    filters: ServiceUsersFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ items: ServiceUserReadModel[]; total: number }> {
    const matching = this.store.filter((user) => matches(user, filters));
    const sorted = matching.sort(
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

function matches(
  user: ServiceUserReadModel,
  filters: ServiceUsersFilters,
): boolean {
  if (filters.role && user.role !== String(filters.role)) return false;
  if (filters.status && user.status !== String(filters.status)) return false;
  if (filters.grade && user.grade !== filters.grade) return false;

  const search = filters.search?.trim().toLowerCase();
  if (!search) return true;
  return [user.lastName, user.firstName, user.serviceNumber].some((field) =>
    field.toLowerCase().includes(search),
  );
}
