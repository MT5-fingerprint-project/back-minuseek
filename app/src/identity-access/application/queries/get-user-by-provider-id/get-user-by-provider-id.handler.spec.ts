import { GetUserByProviderIdHandler } from './get-user-by-provider-id.handler';
import { GetUserByProviderIdQuery } from './get-user-by-provider-id.query';
import { InMemoryUserReader } from '../../../infrastructure/persistence/in-memory-user.reader';
import { UserReadModel } from './user-read-model';
import { UserNotFoundError } from '../../../domain/user/errors/user-not-found.error';

const makeUser = (
  overrides: Partial<UserReadModel> = {},
): UserReadModel => ({
  id: 'id-1',
  identityProviderId: 'kc-sub-1',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  firstName: 'Marie',
  lastName: 'Curie',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('GetUserByProviderIdHandler', () => {
  let handler: GetUserByProviderIdHandler;
  let reader: InMemoryUserReader;

  beforeEach(() => {
    reader = new InMemoryUserReader();
    handler = new GetUserByProviderIdHandler(reader);
  });

  it("retourne l'utilisateur correspondant à l'identity provider id", async () => {
    reader.store.push(makeUser({ identityProviderId: 'kc-sub-1' }));
    reader.store.push(makeUser({ id: 'id-2', identityProviderId: 'kc-sub-2' }));

    const user = await handler.execute(
      new GetUserByProviderIdQuery('kc-sub-2'),
    );

    expect(user.id).toBe('id-2');
    expect(user.identityProviderId).toBe('kc-sub-2');
    expect(user.role).toBe('OPERATOR');
    expect(user.firstName).toBe('Marie');
  });

  it("lève une UserNotFoundError si aucun utilisateur ne correspond", async () => {
    await expect(
      handler.execute(new GetUserByProviderIdQuery('inconnu')),
    ).rejects.toThrow(UserNotFoundError);
  });
});
