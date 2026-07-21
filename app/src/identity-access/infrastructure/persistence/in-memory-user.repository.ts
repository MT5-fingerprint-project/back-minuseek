import { User } from '../../domain/user/entity/user';
import { UserRepository } from '../../domain/user/repository/user.repository';

export class InMemoryUserRepository implements UserRepository {
  readonly store = new Map<string, User>();

  save(user: User): Promise<void> {
    this.store.set(user.id, user);
    return Promise.resolve();
  }

  existsByIdentityProviderId(identityProviderId: string): Promise<boolean> {
    for (const user of this.store.values()) {
      if (user.identityProviderId === identityProviderId) {
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  existsByServiceNumber(serviceNumber: string): Promise<boolean> {
    for (const user of this.store.values()) {
      if (user.serviceNumber === serviceNumber) return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
}
