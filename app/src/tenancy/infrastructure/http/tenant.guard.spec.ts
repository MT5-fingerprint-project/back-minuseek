import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
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

function guardFor(routeIsSystemRealmOnly: boolean): TenantGuard {
  const reflector = {
    getAllAndOverride: () => routeIsSystemRealmOnly,
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
