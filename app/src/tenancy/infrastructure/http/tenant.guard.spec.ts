import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE_KEY } from '../../../auth/infrastructure/http/public-route.decorator';
import { TenantGuard } from './tenant.guard';
import type { TenantContext } from '../../application/tenant-context.service';

type GuardedRequest = {
  user?: { tenantSlug?: string; isSystemRealm?: boolean };
  tenantContext?: TenantContext;
};

function executionContextFor(request: GuardedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardFor(
  routeIsSystemRealmOnly: boolean,
  routeIsPublic = false,
): TenantGuard {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === PUBLIC_ROUTE_KEY ? routeIsPublic : routeIsSystemRealmOnly,
  } as unknown as Reflector;
  return new TenantGuard(reflector);
}

describe('TenantGuard — routes métier', () => {
  const guard = guardFor(false);

  it('pose request.tenantContext depuis le tenant prouvé par la stratégie', () => {
    const request: GuardedRequest = { user: { tenantSlug: 'tenant-demo' } };
    expect(guard.canActivate(executionContextFor(request))).toBe(true);
    expect(request.tenantContext).toEqual({ slug: 'tenant-demo' });
  });

  it('rejette un token système sur les routes métier (deny-by-default, IA-12)', () => {
    const request: GuardedRequest = { user: { isSystemRealm: true } };
    expect(() => guard.canActivate(executionContextFor(request))).toThrow(
      ForbiddenException,
    );
    expect(request.tenantContext).toBeUndefined();
  });

  it('rejette une requête sans user (ordre de guards cassé)', () => {
    expect(() => guard.canActivate(executionContextFor({}))).toThrow(
      ForbiddenException,
    );
  });

  it('rejette un user sans tenant prouvé ni realm système', () => {
    expect(() => guard.canActivate(executionContextFor({ user: {} }))).toThrow(
      ForbiddenException,
    );
  });
});

describe('TenantGuard — routes @SystemRealmOnly()', () => {
  const guard = guardFor(true);

  it('laisse passer un token système SANS poser de contexte tenant', () => {
    const request: GuardedRequest = { user: { isSystemRealm: true } };
    expect(guard.canActivate(executionContextFor(request))).toBe(true);
    expect(request.tenantContext).toBeUndefined();
  });

  it('rejette un token tenant (aiguillage exclusif)', () => {
    const request: GuardedRequest = { user: { tenantSlug: 'tenant-demo' } };
    expect(() => guard.canActivate(executionContextFor(request))).toThrow(
      ForbiddenException,
    );
    expect(request.tenantContext).toBeUndefined();
  });
});

describe('TenantGuard — routes publiques', () => {
  const guard = guardFor(false, true);

  it('laisse passer sans utilisateur : la route résout son laboratoire depuis l’URL', () => {
    const request: GuardedRequest = {};

    expect(guard.canActivate(executionContextFor(request))).toBe(true);
  });

  it('ne pose aucun contexte de laboratoire : rien n’ouvrira la base d’un client', () => {
    const request: GuardedRequest = {};

    guard.canActivate(executionContextFor(request));

    expect(request.tenantContext).toBeUndefined();
  });

  it('n’ouvre pas la dérogation aux routes qui ne la portent pas', () => {
    const strict = guardFor(false, false);

    expect(() => strict.canActivate(executionContextFor({}))).toThrow(
      ForbiddenException,
    );
  });
});
