import { UserReadModel } from './user-read-model';

export interface UserReader {
  findByIdentityProviderId(
    identityProviderId: string,
  ): Promise<UserReadModel | null>;
}

export const USER_READER = 'UserReader';
