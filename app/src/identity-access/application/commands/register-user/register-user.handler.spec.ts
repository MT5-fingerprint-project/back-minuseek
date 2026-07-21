import { InMemoryUserRepository } from '../../../infrastructure/persistence/in-memory-user.repository';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import {
  ServiceNumberAlreadyExistsError,
  UserAlreadyRegisteredError,
} from '../../../domain/user/errors/user-already-registered.error';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { RegisterUserCommand } from './register-user.command';
import { RegisterUserHandler } from './register-user.handler';

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly id: string) {}
  generate(): string {
    return this.id;
  }
}

const buildCommand = (overrides: Partial<RegisterUserCommand> = {}) =>
  new RegisterUserCommand(
    overrides.identityProviderId ?? 'kc-sub-123',
    overrides.role ?? UserRoleEnum.OPERATOR,
    overrides.grade ?? 'Capitaine',
    overrides.serviceNumber ?? 'SN-4212',
    overrides.firstName ?? 'Jean',
    overrides.lastName ?? 'Dupont',
  );

describe('RegisterUserHandler', () => {
  let repo: InMemoryUserRepository;
  let handler: RegisterUserHandler;

  beforeEach(() => {
    repo = new InMemoryUserRepository();
    handler = new RegisterUserHandler(repo, new FixedIdGenerator('user-1'));
  });

  it('enregistre un nouvel utilisateur et retourne son id', async () => {
    const id = await handler.execute(buildCommand());

    expect(id).toBe('user-1');
    const stored = repo.store.get('user-1');
    expect(stored?.identityProviderId).toBe('kc-sub-123');
    expect(stored?.serviceNumber).toBe('SN-4212');
    expect(stored?.role.getValue()).toBe(UserRoleEnum.OPERATOR);
    expect(stored?.personalData.firstName).toBe('Jean');
  });

  it('refuse un identity provider id déjà enregistré', async () => {
    await handler.execute(buildCommand());

    await expect(
      handler.execute(buildCommand({ serviceNumber: 'SN-9999' })),
    ).rejects.toBeInstanceOf(UserAlreadyRegisteredError);
  });

  it('refuse un numéro de service déjà utilisé', async () => {
    await handler.execute(buildCommand());

    await expect(
      handler.execute(buildCommand({ identityProviderId: 'kc-sub-999' })),
    ).rejects.toBeInstanceOf(ServiceNumberAlreadyExistsError);
  });
});
