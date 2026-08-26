import { ServiceUserReadModel } from './service-user-read-model';

export interface ServiceUsersReader {
  findAll(pagination: {
    skip: number;
    take: number;
  }): Promise<{ items: ServiceUserReadModel[]; total: number }>;
}

export const SERVICE_USERS_READER = 'ServiceUsersReader';
