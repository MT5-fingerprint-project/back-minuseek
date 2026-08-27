import { ServiceUserReadModel } from './service-user-read-model';
import { ServiceUsersFilters } from './service-users-filters';

export interface ServiceUsersReader {
  findAll(
    filters: ServiceUsersFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ items: ServiceUserReadModel[]; total: number }>;
}

export const SERVICE_USERS_READER = 'ServiceUsersReader';
