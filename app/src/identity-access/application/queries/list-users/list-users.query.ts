import { ServiceUsersFilters } from './service-users-filters';

export class ListUsersQuery {
  constructor(
    public readonly page?: number,
    public readonly limit?: number,
    public readonly filters: ServiceUsersFilters = {},
  ) {}
}
