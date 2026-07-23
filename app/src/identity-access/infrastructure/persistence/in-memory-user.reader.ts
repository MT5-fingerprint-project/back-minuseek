import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { UserReader } from '../../application/queries/get-user-by-provider-id/user.reader';

export class InMemoryUserReader implements UserReader {
  readonly store: UserReadModel[] = [];

  findByIdentityProviderId(
    identityProviderId: string,
  ): Promise<UserReadModel | null> {
    return Promise.resolve(
      this.store.find((u) => u.identityProviderId === identityProviderId) ??
        null,
    );
  }
}
