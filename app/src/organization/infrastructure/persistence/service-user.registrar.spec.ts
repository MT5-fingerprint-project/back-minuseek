import type { CommandBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { RegisterUserCommand } from '../../../identity-access/application/commands/register-user/register-user.command';
import {
  ServiceNumberAlreadyExistsError,
  UserAlreadyRegisteredError,
} from '../../../identity-access/domain/user/errors/user-already-registered.error';
import { OrganizationUserConflictError } from '../../application/organization.errors';
import { ServiceUserRegistrar } from './service-user.registrar';

const TO_REGISTER = {
  organizationSlug: 'labo-lyon',
  identityProviderId: 'kc-chef',
  role: 'OPERATOR',
  grade: 'Capitaine',
  serviceNumber: 'SN-4212',
  firstName: 'Jean',
  lastName: 'Dupont',
};

function build(dispatch: (command: RegisterUserCommand) => Promise<unknown>) {
  const tenantContext = new TenantContextService();
  const seenTenants: Array<string | undefined> = [];
  const commandBus = {
    execute: (command: RegisterUserCommand) => {
      seenTenants.push(tenantContext.getCurrentTenant());
      return dispatch(command);
    },
  } as unknown as CommandBus;
  return {
    registrar: new ServiceUserRegistrar(commandBus, tenantContext),
    tenantContext,
    seenTenants,
  };
}

describe('ServiceUserRegistrar', () => {
  it('enregistre le compte dans la base du service désigné par le slug', async () => {
    const dispatched: RegisterUserCommand[] = [];
    const { registrar, seenTenants } = build((command) => {
      dispatched.push(command);
      return Promise.resolve('user-1');
    });

    await registrar.register(TO_REGISTER);

    expect(seenTenants).toEqual(['labo-lyon']);
    expect(dispatched).toEqual([
      new RegisterUserCommand(
        'kc-chef',
        'OPERATOR',
        'Capitaine',
        'SN-4212',
        'Jean',
        'Dupont',
      ),
    ]);
  });

  it('ne laisse pas le tenant du service dans le contexte après l’appel', async () => {
    const { registrar, tenantContext } = build(() => Promise.resolve('user-1'));

    await registrar.register(TO_REGISTER);

    expect(tenantContext.getCurrentTenant()).toBeUndefined();
  });

  it('traduit un compte déjà enregistré en conflit d’organisation', async () => {
    const { registrar } = build(() =>
      Promise.reject(new UserAlreadyRegisteredError('kc-chef')),
    );

    await expect(registrar.register(TO_REGISTER)).rejects.toThrow(
      OrganizationUserConflictError,
    );
  });

  it('traduit un matricule déjà pris en conflit d’organisation, message compris', async () => {
    const { registrar } = build(() =>
      Promise.reject(new ServiceNumberAlreadyExistsError('SN-4212')),
    );

    await expect(registrar.register(TO_REGISTER)).rejects.toThrow(
      new OrganizationUserConflictError(
        'Le numéro de service "SN-4212" est déjà utilisé',
      ),
    );
  });

  it('laisse remonter une panne d’infrastructure telle quelle', async () => {
    const { registrar } = build(() =>
      Promise.reject(new Error('base injoignable')),
    );

    await expect(registrar.register(TO_REGISTER)).rejects.toThrow(
      'base injoignable',
    );
    await expect(registrar.register(TO_REGISTER)).rejects.not.toThrow(
      OrganizationUserConflictError,
    );
  });
});
