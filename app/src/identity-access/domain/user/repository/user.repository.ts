import { User } from '../entity/user';

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  existsByIdentityProviderId(identityProviderId: string): Promise<boolean>;
  existsByServiceNumber(serviceNumber: string): Promise<boolean>;
}

export const USER_REPOSITORY = 'UserRepository';
