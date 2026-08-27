import { User } from '../../domain/user/entity/user';
import { UserRepository } from '../../domain/user/repository/user.repository';

export class InMemoryUserRepository implements UserRepository {
  readonly store = new Map<string, User>();

  saveFailure: Error | undefined;

  save(user: User): Promise<void> {
    if (this.saveFailure) {
      return Promise.reject(this.saveFailure);
    }
    this.store.set(user.id, User.reconstitute(user.toPrimitives()));
    return Promise.resolve();
  }

  findById(id: string): Promise<User | null> {
    const stored = this.store.get(id);
    return Promise.resolve(
      stored ? User.reconstitute(stored.toPrimitives()) : null,
    );
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
