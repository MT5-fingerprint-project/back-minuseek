import { User } from '../entity/user';

export interface UserRepository {
  save(user: User): Promise<void>;
  existsByIdentityProviderId(identityProviderId: string): Promise<boolean>;
  existsByServiceNumber(serviceNumber: string): Promise<boolean>;
}

export const USER_REPOSITORY = 'UserRepository';
