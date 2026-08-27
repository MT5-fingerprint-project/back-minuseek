import type { ExecutionContext } from '@nestjs/common';
import type { QueryBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { GetUserByProviderIdQuery } from '../../application/queries/get-user-by-provider-id/get-user-by-provider-id.query';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { UserNotFoundError } from '../../domain/user/errors/user-not-found.error';
import { CurrentUserGuard, RequestWithCurrentUser } from './current-user.guard';

const MARIE: UserReadModel = {
  id: 'user-1',
  identityProviderId: 'kc-sub-1',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  status: 'ACTIVE',
  firstName: 'Marie',
  lastName: 'Curie',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function build(resolve: (sub: string) => Promise<UserReadModel>) {
  const tenantContext = new TenantContextService();
  const dispatched: Array<{
    query: GetUserByProviderIdQuery;
    tenant: string | undefined;
  }> = [];
  const queryBus = {
    execute: (query: GetUserByProviderIdQuery) => {
      dispatched.push({ query, tenant: tenantContext.getCurrentTenant() });
      return resolve(query.identityProviderId);
    },
  } as unknown as QueryBus;
  return {
    guard: new CurrentUserGuard(queryBus, tenantContext),
    tenantContext,
    dispatched,
  };
}

function contextFor(request: Partial<RequestWithCurrentUser>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const tenantRequest = (sub = 'kc-sub-1'): Partial<RequestWithCurrentUser> => ({
  user: { sub },
  tenantContext: { slug: 'tenant-demo' },
});

describe('CurrentUserGuard', () => {
  it('pose le compte du service de l’appelant sur la requête', async () => {
    const { guard } = build(() => Promise.resolve(MARIE));
    const request = tenantRequest();

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.currentUser).toEqual(MARIE);
  });

  it('résout le compte dans la base du tenant de la requête', async () => {
    const { guard, dispatched } = build(() => Promise.resolve(MARIE));

    await guard.canActivate(contextFor(tenantRequest('kc-sub-9')));

    expect(dispatched).toEqual([
      {
        query: new GetUserByProviderIdQuery('kc-sub-9'),
        tenant: 'tenant-demo',
      },
    ]);
  });

  it('ne laisse pas le tenant de la requête dans le contexte après le garde', async () => {
    const { guard, tenantContext } = build(() => Promise.resolve(MARIE));

    await guard.canActivate(contextFor(tenantRequest()));

    expect(tenantContext.getCurrentTenant()).toBeUndefined();
  });

  it('laisse passer un jeton dont le sub n’a pas de ligne en base, sans compte courant', async () => {
    const { guard } = build((sub) =>
      Promise.reject(new UserNotFoundError(sub)),
    );
    const request = tenantRequest('kc-inconnu');

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(request.currentUser).toBeUndefined();
  });

  it('ne résout aucun compte pour un jeton du realm système', async () => {
    const { guard, dispatched } = build(() => Promise.resolve(MARIE));
    const request: Partial<RequestWithCurrentUser> = {
      user: { sub: 'kc-admin', isSystemRealm: true },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(dispatched).toEqual([]);
    expect(request.currentUser).toBeUndefined();
  });

  it('ne résout aucun compte quand la requête n’a pas de jeton', async () => {
    const { guard, dispatched } = build(() => Promise.resolve(MARIE));
    const request: Partial<RequestWithCurrentUser> = {
      tenantContext: { slug: 'tenant-demo' },
    };

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

    expect(dispatched).toEqual([]);
  });

  it('relève une panne de la base plutôt que de laisser passer sans compte courant', async () => {
    const { guard } = build(() =>
      Promise.reject(new Error('base injoignable')),
    );
    const request = tenantRequest();

    await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
      'base injoignable',
    );
    expect(request.currentUser).toBeUndefined();
  });
});
